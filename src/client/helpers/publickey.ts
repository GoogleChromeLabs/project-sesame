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

import {_fetch} from '~project-sesame/client/helpers';
import {
  Base64URLString,
  RegistrationCredential,
  AuthenticationCredential,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptions,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';
import 'webauthn-polyfills';

export async function preparePublicKeyCreationOptions(): Promise<PublicKeyCredentialCreationOptions> {
  // Fetch passkey creation options from the server.
  const options: PublicKeyCredentialCreationOptionsJSON = await _fetch(
    '/webauthn/registerRequest'
  );

  // @ts-ignore
  return PublicKeyCredential.parseCreationOptionsFromJSON(options);
}

export async function verifyPublicKeyCreationResult(cred: PublicKeyCredential): Promise<any> {
  // @ts-ignore
  const encodedCredential = cred.toJSON();

  // Send the result to the server and return the promise.
  return await _fetch('/webauthn/registerResponse', encodedCredential);
}

export async function preparePublicKeyRequestOptions(
  conditional: boolean = false
): Promise<PublicKeyCredentialRequestOptions> {
  // Fetch passkey request options from the server.
  const options: PublicKeyCredentialRequestOptionsJSON = await _fetch(
    '/webauthn/signinRequest'
  );

  // @ts-ignore
  const decodedOptions = PublicKeyCredential.parseRequestOptionsFromJSON(options);

  // Empty `allowCredentials` if `conditional` is true.
  if (conditional) {
    decodedOptions.allowCredentials = [];
  }

  return decodedOptions;
}

export async function verifyPublicKeyRequestResult(cred: PublicKeyCredential): Promise<any> {

  // @ts-ignore
  const encodedCredential = cred.toJSON();

  // Send the result to the server and return the promise.
  return await _fetch('/webauthn/signinResponse', encodedCredential);
}

/**
 * Create and register a new passkey
 * @returns A promise that resolves with a server response.
 */
export async function registerCredential(): Promise<any> {
  const options = await preparePublicKeyCreationOptions();

  // Invoke WebAuthn create
  const cred = (await navigator.credentials.create({
    publicKey: options,
  })) as RegistrationCredential;

  if (!cred) {
    throw new Error("Failed to create a credential");
  }

  return verifyPublicKeyCreationResult(cred);
}

/**
 * Authenticate with a passkey.
 * @param { boolean } conditional Set to `true` if this is for a conditional UI.
 * @returns A promise that resolves with a server response.
 */
export async function authenticate(conditional = false): Promise<any> {
  const options = await preparePublicKeyRequestOptions(conditional);

  // Invoke WebAuthn get
  const cred = (await navigator.credentials.get({
    publicKey: options,
    // Request a conditional UI
    mediation: conditional ? 'conditional' : 'optional',
  })) as AuthenticationCredential;

  if (!cred) {
    throw new Error("Failed to get a credential");
  }

  return verifyPublicKeyRequestResult(cred);
}

/**
 * Request to update the namme of a passkey.
 * @param { Base64URLString } credId A Base64URL encoded credential ID of the passkey to unregister.
 * @param { string } newName A new name for the passkey.
 * @returns a promise that resolves with a server response.
 */
export async function updateCredential(
  credId: Base64URLString,
  newName: string
): Promise<any> {
  return _fetch('/webauthn/renameKey', {credId, newName});
}

/**
 * Request to unregister a passkey.
 * @param { string } credId A Base64URL encoded credential ID of the passkey to unregister.
 * @returns a promise that resolves with a server response.
 */
export async function unregisterCredential(
  credId: Base64URLString
): Promise<any> {
  return _fetch(`/webauthn/removeKey?credId=${encodeURIComponent(credId)}`);
}
