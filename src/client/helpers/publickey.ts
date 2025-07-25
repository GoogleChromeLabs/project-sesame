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

import {post} from '~project-sesame/client/helpers/index';
import {
  Base64URLString,
  RegistrationCredential,
  AuthenticationCredential,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptions,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import {SesamePublicKeyCredential} from '~project-sesame/server/libs/public-key-credentials';
import 'webauthn-polyfills';

export const capabilities =
  window?.PublicKeyCredential &&
  (await PublicKeyCredential.getClientCapabilities());

let controller = new AbortController();

export async function preparePublicKeyCreationOptions(
  non_platform = false
): Promise<PublicKeyCredentialCreationOptions> {
  // Fetch passkey creation options from the server.
  const options: PublicKeyCredentialCreationOptionsJSON = await post(
    non_platform
      ? '/webauthn/registerRequest?non_platform'
      : '/webauthn/registerRequest'
  );

  return PublicKeyCredential.parseCreationOptionsFromJSON(options);
}

export async function verifyPublicKeyCreationResult(
  cred: PublicKeyCredential,
  rpId: string = '',
  conditional: boolean
): Promise<any> {
  const encodedCredential = cred.toJSON();

  try {
    const path = conditional
      ? '/webauthn/registerResponse?conditional'
      : '/webauthn/registerResponse';

    // Send the result to the server and return the promise.
    const result = await post(path, encodedCredential);
    return result;
  } catch (e: any) {
    // Detect if the credential was not found.
    // @ts-ignore
    if (PublicKeyCredential.signalUnknownCredential) {
      // Send a signal to delete the credential that was just created.
      // @ts-ignore
      await PublicKeyCredential.signalUnknownCredential({
        rpId,
        credentialId: cred.id,
      });
      console.info(
        'The passkey failed to register has been signaled to the password manager.'
      );
    }
    throw new Error(e.error);
  }
}

export async function preparePublicKeyRequestOptions(
  mediation: CredentialMediationRequirement
): Promise<PublicKeyCredentialRequestOptions> {
  // Fetch passkey request options from the server.
  const options: PublicKeyCredentialRequestOptionsJSON = await post(
    '/webauthn/signinRequest'
  );

  const decodedOptions =
    PublicKeyCredential.parseRequestOptionsFromJSON(options);

  // Empty `allowCredentials` if `conditional` is true.
  if (mediation === 'conditional') {
    decodedOptions.allowCredentials = [];
  }

  return decodedOptions;
}

export async function verifyPublicKeyRequestResult(
  cred: PublicKeyCredential,
  rpId: string = ''
): Promise<any> {
  const encodedCredential = cred.toJSON();

  try {
    // Send the result to the server and return the promise.
    const result = await post('/webauthn/signinResponse', encodedCredential);
    return result;
  } catch (e: any) {
    // @ts-ignore
    if (e.status === 404 && PublicKeyCredential.signalUnknownCredential) {
      // @ts-ignore
      await PublicKeyCredential.signalUnknownCredential({
        rpId,
        credentialId: cred.id,
      })
        .then(() => {
          console.info(
            'The passkey associated with the credential not found has been signaled to the password manager.'
          );
        })
        .catch((e: any) => {
          console.error(e);
        });
    }
    throw new Error(e.error);
  }
}

/**
 * Create and register a new passkey
 * @returns A promise that resolves with a server response.
 */
export async function registerCredential(
  non_platform = false,
  conditional = false
): Promise<any> {
  // Abort ongoing WebAuthn request
  controller.abort();
  controller = new AbortController();

  const options = await preparePublicKeyCreationOptions(non_platform);

  // Invoke WebAuthn create
  const cred = (await navigator.credentials.create({
    publicKey: options,
    signal: controller.signal,
    // @ts-ignore
    mediation: conditional ? 'conditional' : 'optional',
  })) as RegistrationCredential;

  if (!cred) {
    throw new Error('Failed to create a credential');
  }

  return verifyPublicKeyCreationResult(
    <PublicKeyCredential>cred,
    options.rp.id,
    conditional
  );
}

/**
 * Authenticate with a passkey.
 * @param { boolean } mediation Set to `true` if this is for a conditional UI.
 * @returns A promise that resolves with a server response.
 */
export async function authenticate(
  mediation: CredentialMediationRequirement = 'optional'
): Promise<any> {
  // Abort ongoing WebAuthn request
  controller.abort();
  controller = new AbortController();

  const options = await preparePublicKeyRequestOptions(mediation);

  // Invoke WebAuthn get
  const cred = (await navigator.credentials.get({
    publicKey: options,
    signal: controller.signal,
    // Request a conditional UI
    mediation,
  })) as AuthenticationCredential;

  if (!cred) {
    throw new Error('Failed to get a credential');
  }

  return verifyPublicKeyRequestResult(<PublicKeyCredential>cred, options.rpId);
}

/**
 * Signal the list of credentials so the password manager can synchronize.
 * @param { object } credentials An array of credentials that contains a
 * Base64URL encoded credential ID.
 * @returns a promise that resolve with undefined.
 */
export async function getAllCredentials(): Promise<
  SesamePublicKeyCredential[]
> {
  const {rpId, userId, credentials} = (await post('/webauthn/getKeys')) as {
    rpId: string;
    userId: string;
    credentials: SesamePublicKeyCredential[];
  };
  // @ts-ignore
  if (PublicKeyCredential.signalAllAcceptedCredentials) {
    const allAcceptedCredentialIds = credentials.map(
      (cred: SesamePublicKeyCredential) => cred.id
    );
    // @ts-ignore
    await PublicKeyCredential.signalAllAcceptedCredentials({
      rpId,
      userId, // base64url encoded user ID
      allAcceptedCredentialIds,
    })
      .then(() => {
        console.info(
          'Passkeys list have been signaled to the password manager.'
        );
      })
      .catch((e: any) => {
        console.error(e.message);
      });
  }
  return credentials;
}

export async function deleteAllCredentials(): Promise<void> {
  const {rpId, userId} = (await post('/webauthn/getKeys')) as {
    rpId: string;
    userId: string;
  };
  // @ts-ignore
  if (PublicKeyCredential.signalAllAcceptedCredentials) {
    try {
      // @ts-ignore
      await PublicKeyCredential.signalAllAcceptedCredentials({
        rpId,
        userId, // base64url encoded user ID
        allAcceptedCredentialIds: [],
      });
      console.info('Passkeys list have been signaled to the password manager.');
    } catch (e: any) {
      console.error(e.message);
    }
  }
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
  return post('/webauthn/renameKey', {credId, newName});
}

/**
 * Request to unregister a passkey.
 * @param { string } credId A Base64URL encoded credential ID of the passkey to unregister.
 * @returns a promise that resolves with a server response.
 */
export async function unregisterCredential(
  credId: Base64URLString
): Promise<any> {
  return post(`/webauthn/removeKey?credId=${encodeURIComponent(credId)}`);
}
