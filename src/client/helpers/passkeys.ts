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
  RegistrationResponseJSON,
  AuthenticatorAttestationResponseJSON,
  AuthenticationCredential,
  AuthenticationResponseJSON,
  AuthenticatorAssertionResponseJSON,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptions,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';

/**
 * Encode given buffer or decode given string with Base64URL.
 */
class base64url {
  static encode(buffer: ArrayBuffer): string {
    const base64 = window.btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  static decode(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binStr = window.atob(base64);
    const bin = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bin[i] = binStr.charCodeAt(i);
    }
    return bin.buffer;
  }
}

if (PublicKeyCredential) {
  // @ts-ignore
  if (!PublicKeyCredential?.parseCreationOptionsFromJSON) {
    // @ts-ignore
    PublicKeyCredential.parseCreationOptionsFromJSON = (
      options: PublicKeyCredentialCreationOptionsJSON
    ): PublicKeyCredentialCreationOptions => {
      const user = {
        ...options.user,
        id: base64url.decode(options.user.id),
      } as PublicKeyCredentialUserEntity;
      const challenge = base64url.decode(options.challenge);
      const excludeCredentials =
        options.excludeCredentials?.map((cred) => {
          return {
            ...cred,
            id: base64url.decode(cred.id),
          } as PublicKeyCredentialDescriptor;
        }) ?? [];
      return {
        ...options,
        user,
        challenge,
        excludeCredentials,
      } as PublicKeyCredentialCreationOptions;
    };
  }
  // @ts-ignore
  if (!PublicKeyCredential?.parseRequestOptionsFromJSON) {
    // @ts-ignore
    PublicKeyCredential.parseRequestOptionsFromJSON = (
      options: PublicKeyCredentialRequestOptionsJSON
    ): PublicKeyCredentialRequestOptions => {
      const challenge = base64url.decode(options.challenge);
      const allowCredentials =
        options.allowCredentials?.map((cred) => {
          return {
            ...cred,
            id: base64url.decode(cred.id),
          } as PublicKeyCredentialDescriptor;
        }) ?? [];
      return {
        ...options,
        allowCredentials,
        challenge,
      } as PublicKeyCredentialRequestOptions;
    };
  }

  // @ts-ignore
  if (!PublicKeyCredential.prototype.toJSON) {
    // @ts-ignore
    PublicKeyCredential.prototype.toJSON = function(
      this: RegistrationCredential | AuthenticationCredential
    ): AuthenticationResponseJSON | RegistrationResponseJSON {
      try {
        // @ts-ignore
        const id = this.id;
        // @ts-ignore
        const rawId = base64url.encode(this.rawId);
        // @ts-ignore
        const authenticatorAttachment = this.authenticatorAttachment;
        const clientExtensionResults = {};
        // @ts-ignore
        const type = this.type;
        // This is authentication.
        // @ts-ignore
        if (this.response.signature) {
          return {
            id,
            rawId,
            response: {
              // @ts-ignore
              authenticatorData: base64url.encode(this.response.authenticatorData),
              // @ts-ignore
              clientDataJSON: base64url.encode(this.response.clientDataJSON),
              // @ts-ignore
              signature: base64url.encode(this.response.signature),
              // @ts-ignore
              userHandle: base64url.encode(this.response.userHandle),
            } as AuthenticatorAssertionResponseJSON,
            authenticatorAttachment,
            clientExtensionResults,
            type,
          } as AuthenticationResponseJSON;
        } else {
          return {
            id,
            rawId,
            response: {
              // @ts-ignore
              clientDataJSON: base64url.encode(this.response.clientDataJSON),
              // @ts-ignore
              attestationObject: base64url.encode(this.response.attestationObject),
              // @ts-ignore
              transports: this.response?.getTransports() || [],
            } as AuthenticatorAttestationResponseJSON,
            authenticatorAttachment,
            clientExtensionResults,
            type,
          } as RegistrationResponseJSON;
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    }
  }
}

/**
 * Create and register a new passkey
 * @returns A promise that resolves with a server response.
 */
export async function registerCredential(): Promise<any> {
  // Fetch passkey creation options from the server.
  const options: PublicKeyCredentialCreationOptionsJSON = await _fetch(
    '/webauthn/registerRequest'
  );

  // @ts-ignore
  const decodedOptions = PublicKeyCredential.parseCreationOptionsFromJSON(options);

  // Invoke WebAuthn create
  const cred = (await navigator.credentials.create({
    publicKey: decodedOptions,
  })) as RegistrationCredential;

  if (!cred) {
    throw new Error("Failed to create credential");
  }

  // @ts-ignore
  const encodedCredential = cred.toJSON();

  // Send the result to the server and return the promise.
  return await _fetch('/webauthn/registerResponse', encodedCredential);
}

/**
 * Authenticate with a passkey.
 * @param { boolean } conditional Set to `true` if this is for a conditional UI.
 * @returns A promise that resolves with a server response.
 */
export async function authenticate(conditional = false): Promise<any> {
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

  // Invoke WebAuthn get
  const cred = (await navigator.credentials.get({
    publicKey: decodedOptions,
    // Request a conditional UI
    mediation: conditional ? 'conditional' : 'optional',
  })) as AuthenticationCredential;

  if (!cred) {
    throw new Error("Failed to get credential");
  }

  // @ts-ignore
  const encodedCredential = cred.toJSON();

  // Send the result to the server and return the promise.
  return await _fetch('/webauthn/signinResponse', encodedCredential);
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
