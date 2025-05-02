/*
 * @license
 * Copyright 2023 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */
import {Router, Request, Response} from 'express';
const router = Router();
// import crypto from 'crypto';
import {
  AuthenticationResponseJSON,
  AuthenticatorAssertionResponseJSON,
  Base64URLString,
  GenerateAuthenticationOptionsOpts,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  VerifyAuthenticationResponseOpts,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  WebAuthnCredential,
} from '@simplewebauthn/server';
import {isoBase64URL} from '@simplewebauthn/server/helpers';
import {config} from '~project-sesame/server/config.ts';
import {
  PublicKeyCredentials,
  SesamePublicKeyCredential,
} from '~project-sesame/server/libs/public-key-credentials.ts';
import {
  generatePasskeyUserId,
  Users,
} from '~project-sesame/server/libs/users.ts';
import {csrfCheck, getTime} from '~project-sesame/server/middlewares/common.ts';
import {
  apiAclCheck,
  ApiType,
  UserSignInStatus,
  deleteChallenge,
  deleteEpehemeralPasskeyUserId,
  getChallenge,
  getEphemeralPasskeyUserId,
  setChallenge,
  setEphemeralPasskeyUserId,
  setSignedIn,
} from '~project-sesame/server/middlewares/session.ts';
import aaguids from '~project-sesame/shared/public/aaguids.json' with {type: 'json'};

interface AAGUIDs {
  [key: string]: {
    name: string;
    icon_light?: string;
  };
}

router.use(csrfCheck);

/**
 * Respond with a list of stored credentials.
 */
router.post(
  '/getKeys',
  apiAclCheck(ApiType.SignedIn),
  async (req: Request, res: Response) => {
    const {user} = res.locals;
    const credentials = await PublicKeyCredentials.findByPasskeyUserId(
      user.passkeyUserId
    );
    const rpId = config.hostname;
    const userId = user.passkeyUserId;
    if (credentials && credentials.length > 0) {
      for (let credential of credentials) {
        const aaguid =
          credential.aaguid ?? '00000000-0000-0000-0000-000000000000';
        const entry = (aaguids as AAGUIDs)[aaguid];
        credential.provider_icon = entry.icon_light;
        credential.providerIcon = entry.icon_light;
      }
    }
    return res.json({rpId, userId, credentials});
  }
);

/**
 * Update the name of a passkey.
 */
router.post(
  '/renameKey',
  apiAclCheck(ApiType.Sensitive),
  async (req: Request, res: Response) => {
    const {credId, newName} = req.body;
    const {user} = res.locals;
    const credential = await PublicKeyCredentials.findById(credId);
    if (
      !user ||
      !credential ||
      user.passkeyUserId !== credential?.passkeyUserId
    ) {
      return res.status(401).json({error: 'User not authorized.'});
    }
    credential.name = newName;
    await PublicKeyCredentials.update(credential);
    return res.json(credential);
  }
);

/**
 * Removes a credential id attached to the user.
 * Responds with empty JSON `{}`.
 **/
router.post(
  '/removeKey',
  apiAclCheck(ApiType.Sensitive),
  async (req: Request, res: Response) => {
    // TODO: Check if the user is authorized to remove the credential.
    const credId = <Base64URLString>req.query.credId;

    await PublicKeyCredentials.remove(credId);

    return res.json({});
  }
);

/**
 * Start creating a new passkey by serving registration options.
 */
router.post(
  '/registerRequest',
  apiAclCheck(ApiType.PasskeyRegistration),
  async (req: Request, res: Response) => {
    let passkeyUserId, username, displayName;
    if (res.locals.signin_status === UserSignInStatus.SigningUp) {
      username = res.locals.username;
      displayName = username;
      passkeyUserId = generatePasskeyUserId();
      setEphemeralPasskeyUserId(passkeyUserId, req, res);
    } else if (res.locals.signin_status >= UserSignInStatus.SignedIn) {
      const {user} = res.locals;
      passkeyUserId = user.passkeyUserId;
      username = user.username;
      displayName = user.displayName;
    }

    try {
      // Create `excludeCredentials` from a list of stored credentials.
      const excludeCredentials = [];
      const credentials =
        await PublicKeyCredentials.findByPasskeyUserId(passkeyUserId);
      for (const cred of credentials || []) {
        excludeCredentials.push({
          id: cred.id,
          type: 'public-key',
          transports: cred.transports,
        });
      }
      // Set `authenticatorSelection`.
      const authenticatorSelection = {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
      } as AuthenticatorSelectionCriteria;
      const attestationType = 'none';

      // Use SimpleWebAuthn's handy function to create registration options.
      const options = await generateRegistrationOptions({
        rpName: config.project_name,
        rpID: config.hostname,
        userID: isoBase64URL.toBuffer(passkeyUserId),
        userName: username,
        userDisplayName: displayName || username,
        // Prompt users for additional information about the authenticator.
        attestationType,
        // Prevent users from re-registering existing authenticators
        excludeCredentials,
        authenticatorSelection,
      });

      // Keep the challenge value in a session.
      setChallenge(req, res, options.challenge);

      // Respond with the registration options.
      return res.json(options);
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({error: error.message});
    }
  }
);

/**
 * Register a new passkey to the server.
 */
router.post(
  '/registerResponse',
  apiAclCheck(ApiType.PasskeyRegistration),
  async (req: Request, res: Response) => {
    let user, passkeyUserId;
    const username = res.locals.username;
    if (res.locals.signin_status === UserSignInStatus.SigningUp) {
      passkeyUserId = getEphemeralPasskeyUserId(req, res);
    } else if (res.locals.signin_status >= UserSignInStatus.SignedIn) {
      user = res.locals.user;
      passkeyUserId = user.passkeyUserId;
    }

    // Set expected values.
    const conditional = req.query.hasOwnProperty('conditional');
    const response = <RegistrationResponseJSON>req.body;
    const expectedChallenge = getChallenge(req, res);
    const expectedOrigin = config.associated_origins;
    const expectedRPID = config.hostname;

    try {
      if (!expectedChallenge) {
        return res.status(400).send({error: 'Invalid challenge'});
      }

      // Use SimpleWebAuthn's handy function to verify the registration request.
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        requireUserPresence: !conditional,
        requireUserVerification: false,
      });

      const {verified, registrationInfo} = verification;

      // If the verification failed, throw.
      if (!verified || !registrationInfo) {
        deleteChallenge(req, res);
        throw new Error('User verification failed.');
      }

      const {credential} = registrationInfo;

      // Base64URL encode ArrayBuffers.
      const base64PublicKey = <Base64URLString>(
        isoBase64URL.fromBuffer(credential.publicKey)
      );

      const aaguid = registrationInfo?.aaguid;
      const name =
        aaguid === undefined ||
        aaguid === '00000000-0000-0000-0000-000000000000'
          ? req.useragent?.platform
          : (aaguids as AAGUIDs)[registrationInfo.aaguid].name;

      // Store the registration result.
      await PublicKeyCredentials.update({
        id: credential.id,
        passkeyUserId: passkeyUserId,
        name,
        credentialPublicKey: base64PublicKey,
        credentialType: registrationInfo.credentialType,
        aaguid: registrationInfo.aaguid,
        transports: response.response.transports || [],
        userVerified: registrationInfo.userVerified,
        credentialDeviceType: registrationInfo.credentialDeviceType,
        credentialBackedUp: registrationInfo.credentialBackedUp,
        registeredAt: getTime(),
      } as SesamePublicKeyCredential);

      // Delete the challenge from the session.
      deleteChallenge(req, res);

      // If this is a sign-up, create a new user
      if (res.locals.signin_status === UserSignInStatus.SigningUp) {
        user = await Users.create(username, {passkeyUserId});
        setSignedIn(user, req, res);
      }

      // Respond with the user information.
      return res.json(user);
    } catch (error: any) {
      deleteChallenge(req, res);

      console.error(error);
      return res.status(400).send({error: error.message});
    }
  }
);

/**
 * Start authenticating the user.
 */
router.post(
  '/signinRequest',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response) => {
    const allowCredentials: PublicKeyCredentialDescriptorJSON[] = [];

    // For reauthentication
    if (res.locals.signin_status >= UserSignInStatus.SignedIn) {
      const credentials = await PublicKeyCredentials.findByPasskeyUserId(
        res.locals.user.passkeyUserId
      );
      if (!credentials?.length) {
        return res
          .status(404)
          .json({error: 'No credentials found to sign in with.'});
      }

      for (let cred of credentials) {
        allowCredentials.push({
          id: cred.id,
          type: 'public-key',
          transports: cred.transports,
        });
      }
    }
    try {
      // Use SimpleWebAuthn's handy function to create a new authentication request.
      const options = await generateAuthenticationOptions({
        rpID: config.hostname,
        allowCredentials,
      } as GenerateAuthenticationOptionsOpts);

      // Keep the challenge value in a session.
      setChallenge(req, res, options.challenge);

      return res.json(options);
    } catch (error: any) {
      console.error(error);

      return res.status(500).json({error: error.message});
    }
  }
);

/**
 * Verify the authentication request.
 */
router.post(
  '/signinResponse',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response) => {
    // Set expected values.
    const response = <AuthenticationResponseJSON>req.body;
    const expectedChallenge = getChallenge(req, res);
    const expectedOrigin = config.associated_origins;
    const expectedRPID = config.hostname;

    try {
      if (!expectedChallenge) {
        return res.status(401).json({error: 'Invalid challenge.'});
      }

      // If the matching public key is not found, return an error
      const cred = await PublicKeyCredentials.findById(response.id);
      if (!cred) {
        deleteChallenge(req, res);
        return res
          .status(404)
          .json({error: 'Matching credential not found on the server.'});
      }

      // If the user is already signed in and passkey user ID doesn't match,
      // return an error.
      if (
        res.locals.user &&
        res.locals.user.passkeyUserId !== cred.passkeyUserId
      ) {
        deleteChallenge(req, res);
        return res.status(400).json({error: 'Wrong sign-in account.'});
      }

      // Find the matching user from the user ID contained in the credential.
      const user = await Users.findByPasskeyUserId(cred.passkeyUserId);
      if (!user) {
        deleteChallenge(req, res);
        return res.status(401).json({error: 'User not found.'});
      }

      // Decode ArrayBuffers and construct a credential.
      const credential = {
        id: cred.id,
        publicKey: isoBase64URL.toBuffer(cred.credentialPublicKey),
        transports: cred.transports,
      } as WebAuthnCredential;

      // Use SimpleWebAuthn's handy function to verify the authentication request.
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        credential,
        requireUserVerification: false,
      } as VerifyAuthenticationResponseOpts);

      const {verified, authenticationInfo} = verification;

      // If the authentication failed, throw.
      if (!verified) {
        deleteChallenge(req, res);
        return res.status(401).json({error: 'User verification failed.'});
      }

      // TODO: Use the `uv` flag as the risk signal.

      // Update the last used timestamp.
      cred.lastUsedAt = getTime();
      await PublicKeyCredentials.update(cred);

      // Set the user as a signed in status
      setSignedIn(user, req, res);

      return res.json(user);
    } catch (error: any) {
      deleteChallenge(req, res);

      console.error(error);
      return res.status(500).json({error: error.message});
    }
  }
);

export {router as webauthn};
