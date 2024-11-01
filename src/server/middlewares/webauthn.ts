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
  WebAuthnCredential,
  Base64URLString,
  RegistrationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
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
  getDeviceId,
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
          // @ts-ignore
          const androidHash = isoBase64URL.fromBuffer(octArray);
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
    const credentials = await PublicKeyCredentials.findByPasskeyUserId(user.passkeyUserId);
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
    if (!user || !credential || user.passkeyUserId !== credential?.passkeyUserId) {
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
      passkeyUserId = user.passkeyUserId;
      username = user.username;
      displayName = user.displayName;
    }

    try {
      // Create `excludeCredentials` from a list of stored credentials.
      const excludeCredentials = [];
      const credentials = await PublicKeyCredentials.findByPasskeyUserId(passkeyUserId);
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
      passkeyUserId = user.passkeyUserId;
    }

    // Set expected values.
    const response = <RegistrationResponseJSON>req.body;
    const expectedChallenge = getChallenge(req, res);
    const expectedOrigin = getOrigin(req.get('User-Agent'));
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
      const name = aaguid === undefined ||
          aaguid === '00000000-0000-0000-0000-000000000000'
          ? req.useragent?.platform
          : (aaguids as AAGUIDs)[registrationInfo.aaguid].name;

      const deviceId = getDeviceId(req, res);

      // Store the registration result.
      await PublicKeyCredentials.update({
        id: credential.id,
        deviceId,
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

      if (res.locals.signin_status === SignInStatus.SigningUp) {
        user = await Users.create(username, {passkeyUserId: passkeyUserId});
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
  sessionCheck,
  async (req: Request, res: Response) => {
    const allowCredentials = [];

    // For reauthentication
    if (res.locals.signin_status >= SignInStatus.SignedIn) {

      const credentials = await PublicKeyCredentials.findByPasskeyUserId(res.locals.user.passkeyUserId);
      if (!credentials?.length) {
        return res.status(404).json({error: 'No credentials found.'});
      }

      // If the device ID is known, pick the credential by the device ID.
      // TODO: If a roaming authenticator is registered, this will likely fail.
      // Think of a better way to handle this.
      const device_id = getDeviceId(req, res);
      const creds = credentials.filter(cred => cred.deviceId === device_id);

      // If credentials with the matching device ID are found, fill
      // `allowCredentials` with them. Otherwise, return an empty
      // `allowCredentials`.
      if (creds.length > 0) {
        for (let cred of creds) {
          allowCredentials.push({
            id: cred.id,
            type: 'public-key',
            transports: cred.transports,
          });
        }
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
  csrfCheck,
  sessionCheck,
  async (req: Request, res: Response) => {
    // Set expected values.
    const response = <AuthenticationResponseJSON>req.body;
    const expectedChallenge = getChallenge(req, res);
    const expectedOrigin = getOrigin(req.get('User-Agent'));
    const expectedRPID = config.hostname;

    try {
      if (!expectedChallenge) {
        return res.status(401).json({error: 'Invalid challenge.'});
      }

      // Find the matching credential from the credential ID
      const cred = await PublicKeyCredentials.findById(response.id);
      if (!cred) {
        deleteChallenge(req, res);
        return res.status(401).json({error:
          'Matching credential not found on the server. Try signing in with a password.'
        });
      }

      // If the user is already signed in and passkey user ID doesn't match,
      // return an error.
      if (res.locals.signin_status >= SignInStatus.SignedIn &&
          res.locals.user.passkeyUserId !== cred.passkeyUserId) {
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
