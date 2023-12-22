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

import { _fetch, base64url } from './client.js';

/**
 * Create and register a new passkey
 * @returns A promise that resolves with a server response.
 */
export async function registerCredential() {
  // Fetch passkey creation options from the server.
  const options = await _fetch('/webauthn/registerRequest');

  // Base64URL decode some values
  options.user.id = base64url.decode(options.user.id);
  options.challenge = base64url.decode(options.challenge);
  if (options.excludeCredentials) {
    for (let cred of options.excludeCredentials) {
      cred.id = base64url.decode(cred.id);
    }
  }

  // Use platform authenticator and discoverable credential
  options.authenticatorSelection = {
    authenticatorAttachment: 'platform',
    requireResidentKey: true
  }

  // Invoke WebAuthn create
  const cred = await navigator.credentials.create({
    publicKey: options,
  });

  const credential = {};
  credential.id = cred.id;
  // Base64URL encode `rawId`
  credential.rawId = base64url.encode(cred.rawId);
  credential.type = cred.type;

  // `authenticatorAttachment` in PublicKeyCredential is a new addition in WebAuthn L3
  if (cred.authenticatorAttachment) {
    credential.authenticatorAttachment = cred.authenticatorAttachment;
  }

  // Base64URL encode some values
  const clientDataJSON = base64url.encode(cred.response.clientDataJSON);
  const attestationObject = base64url.encode(cred.response.attestationObject);

  // Obtain transports if they are available.
  const transports = cred.response.getTransports ? cred.response.getTransports() : [];

  credential.response = {
    clientDataJSON,
    attestationObject,
    transports
  };

  // Send the result to the server and return the promise.
  return await _fetch('/webauthn/registerResponse', credential);
};

/**
 * Authenticate with a passkey.
 * @param { boolean } conditional Set to `true` if this is for a conditional UI.
 * @returns A promise that resolves with a server response.
 */
export async function authenticate(conditional = false) {
  // Fetch passkey request options from the server.
  const options = await _fetch('/webauthn/signinRequest');

  // Base64URL decode the challenge
  options.challenge = base64url.decode(options.challenge);

  // `allowCredentials` empty array invokes an account selector by discoverable credentials.
  options.allowCredentials = [];

  // Invoke WebAuthn get
  const cred = await navigator.credentials.get({
    publicKey: options,
    // Request a conditional UI
    mediation: conditional ? 'conditional' : 'optional'
  });

  const credential = {};
  credential.id = cred.id;
  credential.type = cred.type;
  // Base64URL encode `rawId`
  credential.rawId = base64url.encode(cred.rawId);

  // Base64URL encode some values
  const clientDataJSON = base64url.encode(cred.response.clientDataJSON);
  const authenticatorData = base64url.encode(cred.response.authenticatorData);
  const signature = base64url.encode(cred.response.signature);
  const userHandle = base64url.encode(cred.response.userHandle);

  credential.response = {
    clientDataJSON,
    authenticatorData,
    signature,
    userHandle,
  };

  // Send the result to the server and return the promise.
  return await _fetch(`/webauthn/signinResponse`, credential);
};

/**
 * Request to update the namme of a passkey.
 * @param { string } credId A Base64URL encoded credential ID of the passkey to unregister.
 * @param { string } newName A new name for the passkey.
 * @returns a promise that resolves with a server response.
 */
export async function updateCredential(credId, newName) {
  return _fetch(`/webauthn/renameKey`, { credId, newName });
}

/**
 * Request to unregister a passkey.
 * @param { string } credId A Base64URL encoded credential ID of the passkey to unregister.
 * @returns a promise that resolves with a server response.
 */
export async function unregisterCredential(credId) {
  return _fetch(`/webauthn/removeKey?credId=${encodeURIComponent(credId)}`);
};
