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
import express, { Request, Response } from 'express';
const router = express.Router();
// import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import {
  Base64URLString,
  AttestationConveyancePreference,
  PublicKeyCredentialParameters,
  AuthenticatorDevice,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialUserEntityJSON,
} from '@simplewebauthn/types';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { Users } from '../libs/users';
import { PublicKeyCredentials } from '../libs/public-key-credentials';
import { csrfCheck, sessionCheck } from './common';
import aaguids from '../static/aaguids.json' assert { type: 'json' };

/**
 * Get the expected origin that the user agent is claiming to be at. If the
 * requester is Android, construct an expected `origin` parameter.
 * @param { string } userAgent A user agent string used to check if it's a web browser.
 * @returns A string that indicates an expected origin.
 */
function getOrigin(
  userAgent: string
): string {
  let origin = process.env.ORIGIN;
  
  const appRe = /^[a-zA-z0-9_.]+/;
  const match = userAgent.match(appRe);
  if (match) {
    // Check if UserAgent comes from a supported Android app.
    if (process.env.ANDROID_PACKAGENAME && process.env.ANDROID_SHA256HASH) {
      // `process.env.ANDROID_PACKAGENAME` is expected to have a comma separated package names.
      const package_names = process.env.ANDROID_PACKAGENAME.split(",").map(name => name.trim());
      // `process.env.ANDROID_SHA256HASH` is expected to have a comma separated hash values.
      const hashes = process.env.ANDROID_SHA256HASH.split(",").map(hash => hash.trim());
      const appName = match[0];
      // Find and construct the expected origin string.
      for (let i = 0; i < package_names.length; i++) {
        if (appName === package_names[i]) {
          // We recognize this app, so use the corresponding hash.
          const octArray = hashes[i].split(':').map((h) =>
            parseInt(h, 16),
          );
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
router.post('/getKeys', csrfCheck, sessionCheck, async (
  req: Request,
  res: Response,
) => {
  const { user } = res.locals;
  const credentials = await PublicKeyCredentials.findByUserId(user.id);
  return res.json(credentials || []);
});

/**
 * Update the name of a passkey.
 */
router.post('/renameKey', csrfCheck, sessionCheck, async (
  req: Request,
  res: Response,
) => {
  const { credId, newName } = req.body;
  const { user } = res.locals;
  const credential = await PublicKeyCredentials.findById(credId);
  if (!user || !credential || user.id !== credential?.user_id) {
    return res.status(401).json({ error: 'User not authorized.' });
  }
  credential.name = newName;
  await PublicKeyCredentials.update(credential);
  return res.json(credential);
});

/**
 * Removes a credential id attached to the user.
 * Responds with empty JSON `{}`.
 **/
router.post('/removeKey', csrfCheck, sessionCheck, async (
  req: Request,
  res: Response,
) => {
  const credId = <Base64URLString>req.query.credId;
  const { user } = res.locals;

  await PublicKeyCredentials.remove(credId, user.id);

  return res.json({});
});

/**
 * Start creating a new passkey by serving registration options.
 */
router.post('/registerRequest', csrfCheck, sessionCheck, async (
  req: Request,
  res: Response,
) => {
  const { user } = res.locals;
  try {
    // Create `excludeCredentials` from a list of stored credentials.
    const excludeCredentials = [];
    const credentials = await PublicKeyCredentials.findByUserId(user.id);
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
      requireResidentKey: true
    } as AuthenticatorSelectionCriteria
    const attestationType = 'none';

    // Use SimpleWebAuthn's handy function to create registration options.
    const options = await generateRegistrationOptions({
      rpName: process.env.PROJECT_NAME,
      rpID: process.env.HOSTNAME,
      userID: user.id,
      userName: user.username,
      userDisplayName: user.displayName || user.username,
      // Prompt users for additional information about the authenticator.
      attestationType,
      // Prevent users from re-registering existing authenticators
      excludeCredentials,
      authenticatorSelection,
    });

    // Keep the challenge value in a session.
    req.session.challenge = options.challenge;

    // Respond with the registration options.
    return res.json(options);
  } catch (e) {
    console.error(e);
    return res.status(400).send({ error: e.message });
  }
});

/**
 * Register a new passkey to the server.
 */
router.post('/registerResponse', csrfCheck, sessionCheck, async (
  req: Request,
  res: Response,
) => {
  // Set expected values.
  const expectedChallenge = req.session.challenge;
  const expectedOrigin = getOrigin(req.get('User-Agent'));
  const expectedRPID = process.env.HOSTNAME;
  const credential = req.body;

  try {

    // Use SimpleWebAuthn's handy function to verify the registration request.
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: false,
    });

    const { verified, registrationInfo } = verification;

    // If the verification failed, throw.
    if (!verified || !registrationInfo) {
      throw new Error('User verification failed.');
    }

    const { credentialPublicKey, credentialID } = registrationInfo;

    // Base64URL encode ArrayBuffers.
    const base64PublicKey = isoBase64URL.fromBuffer(credentialPublicKey);
    const base64CredentialID = isoBase64URL.fromBuffer(credentialID);

    const { user } = res.locals;
    const name = registrationInfo.aaguid === '00000000-0000-0000-0000-000000000000' ?
      req.useragent?.platform :
      aaguids[registrationInfo.aaguid].name;

    // Store the registration result.
    await PublicKeyCredentials.update({
      id: base64CredentialID,
      publicKey: base64PublicKey,
      aaguid: registrationInfo.aaguid,
      name,
      transports: credential.response.transports || [],
      registeredAt: (new Date()).getTime(),
      last_used: null,
      user_id: user.id,
    });

    // Delete the challenge from the session.
    delete req.session.challenge;

    // Respond with the user information.
    return res.json(user);
  } catch (e) {
    delete req.session.challenge;

    console.error(e);
    return res.status(400).send({ error: e.message });
  }
});

/**
 * Start authenticating the user.
 */
router.post('/signinRequest', csrfCheck, async (
  req: Request,
  res: Response,
) => {
  try {
    // Use SimpleWebAuthn's handy function to create a new authentication request.
    const options = await generateAuthenticationOptions({
      rpID: process.env.HOSTNAME,
      allowCredentials: [],
    });

    // Keep the challenge value in a session.
    req.session.challenge = options.challenge;

    return res.json(options)
  } catch (e) {
    console.error(e);

    return res.status(400).json({ error: e.message });
  }
});

/**
 * Verify the authentication request.
 */
router.post('/signinResponse', csrfCheck, async (
  req: Request,
  res: Response,
) => {
  // Set expected values.
  const credential = req.body;
  const expectedChallenge = req.session.challenge;
  const expectedOrigin = getOrigin(req.get('User-Agent'));
  const expectedRPID = process.env.HOSTNAME;

  try {

    // Find the matching credential from the credential ID
    const cred = await PublicKeyCredentials.findById(credential.id);
    if (!cred) {
      throw new Error('Matching credential not found on the server. Try signing in with a password.');
    }

    // Find the matching user from the user ID contained in the credential.
    const user = await Users.findById(cred.user_id);
    if (!user) {
      throw new Error('User not found.');
    }

    // Decode ArrayBuffers and construct an authenticator object.
    const authenticator = {
      credentialPublicKey: isoBase64URL.toBuffer(cred.publicKey),
      credentialID: isoBase64URL.toBuffer(cred.id),
      transports: cred.transports,
    };

    // Use SimpleWebAuthn's handy function to verify the authentication request.
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      authenticator,
      requireUserVerification: false,
    });

    const { verified, authenticationInfo } = verification;

    // If the authentication failed, throw.
    if (!verified) {
      throw new Error('User verification failed.');
    }

    // Update the last used timestamp.
    cred.last_used = (new Date()).getTime();
    await PublicKeyCredentials.update(cred);

    // Delete the challenge from the session.
    delete req.session.challenge;

    // Start a new session.
    req.session.username = user.username;
    req.session['signed-in'] = 'yes';

    // Set a login status using the Login Status API
    res.set('Set-Login', 'logged-in');

    return res.json(user);
  } catch (e) {
    delete req.session.challenge;

    console.error(e);
    return res.status(400).json({ error: e.message });
  }
});

export { router as webauthn };
