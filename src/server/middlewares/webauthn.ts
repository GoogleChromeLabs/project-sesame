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
import express, {Request, Response} from 'express';
const router = express.Router();
// import crypto from 'crypto';
import {
  GenerateAuthenticationOptionsOpts,
  VerifyAuthenticationResponseOpts,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {isoBase64URL} from '@simplewebauthn/server/helpers';
import {
  AuthenticationResponseJSON,
  AuthenticatorAssertionResponseJSON,
  AuthenticatorDevice,
  Base64URLString,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';
import {config} from '~project-sesame/server/config.ts';
import {
  PublicKeyCredentials,
  SesamePublicKeyCredential,
} from '~project-sesame/server/libs/public-key-credentials.ts';
import {Users} from '~project-sesame/server/libs/users.ts';
import {csrfCheck, getTime} from '~project-sesame/server/middlewares/common.ts';
import {
  SignInStatus,
  deleteChallenge,
  deletePasskeyUserId,
  getChallenge,
  getPasskeyUserId,
  getUsername,
  sessionCheck,
  setChallenge,
  setSessionUser,
} from '~project-sesame/server/middlewares/session.ts';
import aaguids from '~project-sesame/shared/public/aaguids.json';
import { get } from 'http';

interface AAGUIDs {
  [key: string]: {
    name: string;
    icon_light?: string;
  };
}

/**
 * Get the expected origin that the user agent is claiming to be at. If the
 * requester is Android, construct an expected `origin` parameter.
 * @param { string } userAgent A user agent string used to check if it's a web browser.
 * @returns A string that indicates an expected origin.
 */
function getOrigin(userAgent = ''): string {
  let origin = config.origin;

  const appRe = /^[a-zA-z0-9_.]+/;
  const match = userAgent.match(appRe);
  if (match) {
    // Check if UserAgent comes from a supported Android app.
    if (process.env.ANDROID_PACKAGENAME && process.env.ANDROID_SHA256HASH) {
      // `process.env.ANDROID_PACKAGENAME` is expected to have a comma separated package names.
      const package_names = process.env.ANDROID_PACKAGENAME.split(',').map(
        name => name.trim()
      );
      // `process.env.ANDROID_SHA256HASH` is expected to have a comma separated hash values.
      const hashes = process.env.ANDROID_SHA256HASH.split(',').map(hash =>
        hash.trim()
      );
      const appName = match[0];
      // Find and construct the expected origin string.
      for (let i = 0; i < package_names.length; i++) {
        if (appName === package_names[i]) {
          // We recognize this app, so use the corresponding hash.
          const octArray = hashes[i].split(':').map(h => parseInt(h, 16));
          const uint8Array = new Uint8Array(octArray.length);
          const androidHash = isoBase64URL.fromBuffer(uint8Array);
          origin = `android:apk-key-hash:${androidHash}`;
          break;
        }
      }
    }
  }

  return origin;
}

/**
 * Respond with a list of stored credentials.
 */
router.post(
  '/getKeys',
  csrfCheck,
  sessionCheck,
  async (req: Request, res: Response) => {
    const {user} = res.locals;
    const credentials = await PublicKeyCredentials.findByPasskeyUserId(user.passkey_user_id);
    return res.json(credentials || []);
  }
);

/**
 * Update the name of a passkey.
 */
router.post(
  '/renameKey',
  csrfCheck,
  sessionCheck,
  async (req: Request, res: Response) => {
    const {credId, newName} = req.body;
    const {user} = res.locals;
    const credential = await PublicKeyCredentials.findById(credId);
    if (!user || !credential || user.passkey_user_id !== credential?.passkey_user_id) {
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
  csrfCheck,
  sessionCheck,
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
  csrfCheck,
  sessionCheck,
  async (req: Request, res: Response) => {
    let passkeyUserId, username, displayName;
    if (res.locals.signin_status === SignInStatus.SigningUp) {
      passkeyUserId = getPasskeyUserId(req, res);
      username = getUsername(req, res);
      displayName = username;
    } else if (res.locals.signin_status >= SignInStatus.SignedIn) {
      const {user} = res.locals;
      passkeyUserId = user.passkey_user_id;
      username = user.username;
      displayName = user.displayName;
    }

    try {
      // Create `excludeCredentials` from a list of stored credentials.
      const excludeCredentials = [];
      const credentials = await PublicKeyCredentials.findByPasskeyUserId(passkeyUserId);
      for (const cred of credentials || []) {
        excludeCredentials.push({
          id: isoBase64URL.toBuffer(cred.id),
          type: 'public-key',
          transports: cred.transports,
        } as PublicKeyCredentialDescriptor);
      }
      // Set `authenticatorSelection`.
      const authenticatorSelection = {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
      } as AuthenticatorSelectionCriteria;
      const attestationType = 'none';

      // Use SimpleWebAuthn's handy function to create registration options.
      const options = await generateRegistrationOptions({
        rpName: config.projectName,
        rpID: config.hostname,
        userID: passkeyUserId,
        userName: username,
        userDisplayName: displayName || username,
        // Prompt users for additional information about the authenticator.
        attestationType,
        // Prevent users from re-registering existing authenticators
        excludeCredentials,
        authenticatorSelection,
      });

      // Keep the challenge value in a session.
      setChallenge(options.challenge, req, res);

      // Respond with the registration options.
      return res.json(options);
    } catch (error: any) {
      console.error(error);
      return res.status(400).send({error: error.message});
    }
  }
);

/**
 * Register a new passkey to the server.
 */
router.post(
  '/registerResponse',
  csrfCheck,
  sessionCheck,
  async (req: Request, res: Response) => {
    let user, username, passkeyUserId;
    if (res.locals.signin_status === SignInStatus.SigningUp) {
      username = getUsername(req, res);
      passkeyUserId = getPasskeyUserId(req, res);
    } else if (res.locals.signin_status >= SignInStatus.SignedIn) {
      user = res.locals.user;
      username = res.locals.username;
      passkeyUserId = user.passkey_user_id;
    }

    // Set expected values.
    const credential = <RegistrationResponseJSON>req.body;
    const expectedChallenge = getChallenge(req, res);
    const expectedOrigin = getOrigin(req.get('User-Agent'));
    const expectedRPID = config.hostname;

    try {
      if (!expectedChallenge) {
        return res.status(400).send({error: 'Invalid challenge'});
      }

      // Use SimpleWebAuthn's handy function to verify the registration request.
      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        requireUserVerification: false,
      });

      const {verified, registrationInfo} = verification;

      // If the verification failed, throw.
      if (!verified || !registrationInfo) {
        deleteChallenge(req, res);
        throw new Error('User verification failed.');
      }

      const {credentialPublicKey, credentialID} = registrationInfo;

      // Base64URL encode ArrayBuffers.
      const base64PublicKey = <Base64URLString>(
        isoBase64URL.fromBuffer(credentialPublicKey)
      );
      const base64CredentialID = <Base64URLString>(
        isoBase64URL.fromBuffer(credentialID)
      );

      const name =
        registrationInfo.aaguid === '00000000-0000-0000-0000-000000000000'
          ? req.useragent?.platform
          : (aaguids as AAGUIDs)[registrationInfo.aaguid].name;

      // Store the registration result.
      await PublicKeyCredentials.update({
        id: base64CredentialID,
        passkey_user_id: passkeyUserId,
        name,
        credentialPublicKey: base64PublicKey,
        credentialType: registrationInfo.credentialType,
        aaguid: registrationInfo.aaguid,
        transports: credential.response.transports || [],
        userVerified: registrationInfo.userVerified,
        credentialDeviceType: registrationInfo.credentialDeviceType,
        credentialBackedUp: registrationInfo.credentialBackedUp,
        registeredAt: getTime(),
      } as SesamePublicKeyCredential);

      // Delete the challenge from the session.
      deleteChallenge(req, res);

      if (res.locals.signin_status === SignInStatus.SigningUp) {
        user = await Users.create(username, {passkey_user_id: passkeyUserId});
        setSessionUser(user, req, res);
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
  csrfCheck,
  async (req: Request, res: Response) => {
    try {
      // Use SimpleWebAuthn's handy function to create a new authentication request.
      const options = await generateAuthenticationOptions({
        rpID: config.hostname,
        allowCredentials: [],
      } as GenerateAuthenticationOptionsOpts);

      // Keep the challenge value in a session.
      setChallenge(options.challenge, req, res);

      return res.json(options);
    } catch (error: any) {
      console.error(error);

      return res.status(400).json({error: error.message});
    }
  }
);

/**
 * Verify the authentication request.
 */
router.post(
  '/signinResponse',
  csrfCheck,
  async (req: Request, res: Response) => {
    // Set expected values.
    const credential = <AuthenticationResponseJSON>req.body;
    const expectedChallenge = getChallenge(req, res);
    const expectedOrigin = getOrigin(req.get('User-Agent'));
    const expectedRPID = config.hostname;

    try {
      if (!expectedChallenge) {
        return res.status(401).json({error: 'Invalid challenge.'});
      }

      // Find the matching credential from the credential ID
      const cred = await PublicKeyCredentials.findById(credential.id);
      if (!cred) {
        deleteChallenge(req, res);
        return res.status(401).json({error:
          'Matching credential not found on the server. Try signing in with a password.'
        });
      }

      // Find the matching user from the user ID contained in the credential.
      const user = await Users.findByPasskeyUserId(cred.passkey_user_id);
      if (!user) {
        deleteChallenge(req, res);
        return res.status(401).json({error: 'User not found.'});
      }

      // Decode ArrayBuffers and construct an authenticator object.
      const authenticator = {
        credentialID: isoBase64URL.toBuffer(cred.id),
        credentialPublicKey: isoBase64URL.toBuffer(cred.credentialPublicKey),
        transports: cred.transports,
      } as AuthenticatorDevice;

      // Use SimpleWebAuthn's handy function to verify the authentication request.
      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        authenticator,
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
      cred.last_used = getTime();
      await PublicKeyCredentials.update(cred);

      // Delete the challenge from the session.
      deleteChallenge(req, res);

      // Set the user as a signed in status
      await setSessionUser(user, req, res);

      return res.json(user);
    } catch (error: any) {
      deleteChallenge(req, res);

      console.error(error);
      return res.status(500).json({error: error.message});
    }
  }
);

export {router as webauthn};
