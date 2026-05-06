/*
 * @license
 * Copyright 2024 Google Inc. All rights reserved.
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

/**
 * Unified authentication helpers.
 * Handles combined flows for Password, Passkeys, and Federated authentication.
 */

import {
  capabilities,
  preparePublicKeyRequestOptions,
  verifyPublicKeyRequestResult,
} from './publickey';
import {SesameIdP} from './identity';
import {verifyPassword} from './password';

let controller = new AbortController();

/**
 * Authenticates the user using a unified prompt (Password, Passkey, or FedCM).
 * @param {Object} [params] - Authentication parameters.
 * @param {CredentialMediationRequirement} [params.mediation] - Credential mediation requirement.
 * @param {CredentialUiMode} [params.ui_mode] - UI mode for the request.
 * @returns {Promise<PasswordCredential | string | undefined>}
 */
export async function authenticate(params?: {
  mediation?: CredentialMediationRequirement,
  // @ts-ignore
  ui_mode?: CredentialUiMode
  // @ts-ignore
}): Promise<PasswordCredential | string | undefined> {
  controller.abort();
  controller = new AbortController();

  const options = await preparePublicKeyRequestOptions(params?.mediation);

  try {
    const cred = await navigator.credentials.get({
      // @ts-ignore
      password: true,
      // temporary experiment for unified auth
      // federated: {
      //   providers: [ 'https://sesame-identity-provider.appspot.com' ],
      // },
      // temporary experiment for unified auth
      publicKey: options,
      ...(params?.mediation && { mediation: params.mediation }),
      ...(params?.ui_mode && { uiMode: params.ui_mode }),
    });
    if (cred?.type === 'password') {
      // @ts-ignore
      return verifyPassword(cred as PasswordCredential);
    } else if (cred?.type === 'public-key') {
      return verifyPublicKeyRequestResult(
        cred as PublicKeyCredential,
        options.rpId
      );
    } else if (cred?.type === 'federated') {
      try {
        const idp = new SesameIdP([
          'https://sesame-identity-provider.appspot.com',
        ]);
        const nonce = await idp.initialize();
        await idp.signIn({
          mode: 'active',
          // loginHint: cred.id,
          nonce,
        });
        return true;
      } catch (e) {
        // Silently dismiss the request for now.
        // TODO: What was I supposed to do when FedCM fails other reasons than "not signed in"?
        console.info('The user is not signed in to the IdP.');
        return false;
      }
    } else {
      return false;
    }
  } catch (error: any) {
    console.error(error);
    throw error;
  }
}

/**
 * Legacy authentication flow (Password and FedCM only).
 * @param {string} [mediation='optional'] - Mediation requirement.
 * @returns {Promise<PasswordCredential | string | undefined>}
 */
export async function legacyAuthenticate(
  mediation: string = 'optional'
  // @ts-ignore
): Promise<PasswordCredential | string | undefined> {
  controller.abort();
  controller = new AbortController();

  if (
    mediation !== 'optional' &&
    mediation !== 'conditional' &&
    mediation !== 'immediate' &&
    mediation !== 'required' &&
    mediation !== 'silent'
  ) {
    throw new Error('Unexpected condition for mediation');
  }

  // const options = await preparePublicKeyRequestOptions(mediation !== 'optional');

  try {
    const cred = await navigator.credentials.get({
      // @ts-ignore
      password: true,
      // temporary experiment for unified auth
      federated: {
        providers: ['https://sesame-identity-provider.appspot.com'],
      },
      // temporary experiment for unified auth
      // publicKey: options,
      // @ts-ignore
      mediation,
    });
    if (cred?.type === 'password') {
      // @ts-ignore
      return verifyPassword(cred as PasswordCredential);
    } else if (cred?.type === 'public-key') {
      // return verifyPublicKeyRequestResult(
      //   cred as PublicKeyCredential,
      //   options.rpId
      // );
    } else if (cred?.type === 'federated') {
      try {
        const idp = new SesameIdP([
          'https://sesame-identity-provider.appspot.com',
        ]);
        await idp.initialize();
        await idp.signIn({
          mode: 'active',
          // loginHint: cred.id,
        });
        return true;
      } catch (e) {
        // Silently dismiss the request for now.
        // TODO: What was I supposed to do when FedCM fails other reasons than "not signed in"?
        console.info('The user is not signed in to the IdP.');
        return false;
      }
    }
    return false;
  } catch (error: any) {
    console.error(error);
    throw error;
  }
}

export {capabilities as capabilities};
