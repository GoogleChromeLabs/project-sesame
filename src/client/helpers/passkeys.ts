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

import { _fetch, base64url } from "~project-sesame/client/helpers";
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
  AuthenticationExtensionsClientOutputs,
} from "@simplewebauthn/types";

/**
 * Create and register a new passkey
 * @returns A promise that resolves with a server response.
 */
export async function registerCredential(): Promise<any> {
  // Fetch passkey creation options from the server.
  const options: PublicKeyCredentialCreationOptionsJSON = await _fetch(
    "/webauthn/registerRequest"
  );

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
  const decodedOptions = {
    ...options,
    user,
    challenge,
    excludeCredentials,
  } as PublicKeyCredentialCreationOptions;

  // Invoke WebAuthn create
  const cred = (await navigator.credentials.create({
    publicKey: decodedOptions,
  })) as RegistrationCredential;

  // Base64URL encode some values
  const rawId = base64url.encode(cred.rawId);
  const clientDataJSON = base64url.encode(cred.response.clientDataJSON);
  const attestationObject = base64url.encode(cred.response.attestationObject);
  const clientExtensionResults: AuthenticationExtensionsClientOutputs = {};

  const encodedCredential = {
    id: cred.id,
    rawId,
    response: {
      clientDataJSON,
      attestationObject,
      transports: cred.response?.getTransports() || [],
    } as AuthenticatorAttestationResponseJSON,
    authenticatorAttachment: cred.authenticatorAttachment,
    clientExtensionResults,
    type: cred.type,
  } as RegistrationResponseJSON;

  // Send the result to the server and return the promise.
  return await _fetch("/webauthn/registerResponse", encodedCredential);
}

/**
 * Authenticate with a passkey.
 * @param { boolean } conditional Set to `true` if this is for a conditional UI.
 * @returns A promise that resolves with a server response.
 */
export async function authenticate(
  conditional: boolean = false
): Promise<any> {
  // Fetch passkey request options from the server.
  const options: PublicKeyCredentialRequestOptionsJSON = await _fetch(
    "/webauthn/signinRequest"
  );

  // Base64URL decode the challenge
  const challenge = base64url.decode(options.challenge);

  // `allowCredentials` empty array invokes an account selector by discoverable credentials.
  const allowCredentials =
    options.allowCredentials?.map((cred) => {
      return {
        ...cred,
        id: base64url.decode(cred.id),
      } as PublicKeyCredentialDescriptor;
    }) ?? [];
  const decodedOptions = {
    ...options,
    allowCredentials,
    challenge,
  } as PublicKeyCredentialRequestOptions;

  // Invoke WebAuthn get
  const cred = (await navigator.credentials.get({
    publicKey: decodedOptions,
    // Request a conditional UI
    mediation: conditional ? "conditional" : "optional",
  })) as AuthenticationCredential;

  // Base64URL encode the credential
  const rawId = base64url.encode(cred.rawId);
  const authenticatorData = base64url.encode(cred.response.authenticatorData);
  const clientDataJSON = base64url.encode(cred.response.clientDataJSON);
  const signature = base64url.encode(cred.response.signature);
  const userHandle = cred.response.userHandle
    ? base64url.encode(cred.response.userHandle)
    : undefined;
  const clientExtensionResults: AuthenticationExtensionsClientOutputs = {};

  const encodedCredential = {
    id: cred.id,
    rawId,
    response: {
      clientDataJSON,
      authenticatorData,
      signature,
      userHandle,
    } as AuthenticatorAssertionResponseJSON,
    authenticatorAttachment: cred.authenticatorAttachment,
    clientExtensionResults,
    type: cred.type,
  } as AuthenticationResponseJSON;

  // Send the result to the server and return the promise.
  return await _fetch(`/webauthn/signinResponse`, encodedCredential);
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
  return _fetch(`/webauthn/renameKey`, { credId, newName });
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
