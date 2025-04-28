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

import {
  Base64URLString,
  CredentialDeviceType,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

import {store} from '~project-sesame/server/config.ts';
import {PasskeyUserId} from './users.ts';

export interface SesamePublicKeyCredential {
  id: Base64URLString;
  passkeyUserId: PasskeyUserId;
  deviceId?: Base64URLString;
  name?: string;
  // User visible identifier.
  credentialPublicKey: Base64URLString; // public key,
  credentialType: string; // type of credential,
  counter?: number; // previous counter,
  aaguid: string; // AAGUID,
  provider_icon?: string; // Provider icon
  userVerified: boolean; // user verifying authenticator,
  transports: AuthenticatorTransportFuture[]; // list of transports,
  browser?: string;
  os?: string;
  platform?: string;
  lastUsedAt?: number; // last used epoc time,
  credentialDeviceType: CredentialDeviceType;
  credentialBackedUp: boolean;
  registeredAt: number;
}

export class PublicKeyCredentials {
  static collection = 'public_key_credentials';

  static async findById(
    credential_id: Base64URLString = ''
  ): Promise<SesamePublicKeyCredential | undefined> {
    const doc = await store
      .collection(PublicKeyCredentials.collection)
      .doc(credential_id)
      .get();
    if (doc) {
      const credential = doc.data();
      return <SesamePublicKeyCredential>credential;
    } else {
      return;
    }
  }

  static async findByPasskeyUserId(
    passkey_user_id: PasskeyUserId = ''
  ): Promise<SesamePublicKeyCredential[] | undefined> {
    const results: SesamePublicKeyCredential[] = [];
    const refs = await store
      .collection(PublicKeyCredentials.collection)
      .where('passkeyUserId', '==', passkey_user_id)
      .orderBy('registeredAt', 'desc')
      .get();
    refs.forEach(cred => results.push(<SesamePublicKeyCredential>cred.data()));
    return results;
  }

  static async update(
    credential: SesamePublicKeyCredential
  ): Promise<FirebaseFirestore.WriteResult> {
    const ref = store
      .collection(PublicKeyCredentials.collection)
      .doc(credential.id);
    return ref.set(credential);
  }

  static async remove(
    credential_id: Base64URLString = ''
  ): Promise<FirebaseFirestore.WriteResult> {
    const ref = store
      .collection(PublicKeyCredentials.collection)
      .doc(credential_id);
    return ref.delete();
  }

  static async deleteByPasskeyUserId(
    passkey_user_id: PasskeyUserId = ''
  ): Promise<void> {
    const creds =
      await PublicKeyCredentials.findByPasskeyUserId(passkey_user_id);
    if (creds) {
      creds.forEach(async cred => {
        await PublicKeyCredentials.remove(cred.id);
      });
    }
  }
}
