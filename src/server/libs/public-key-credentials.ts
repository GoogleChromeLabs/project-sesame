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

import {Base64URLString, CredentialDeviceType} from '@simplewebauthn/server';

import {store} from '~project-sesame/server/config.ts';
import {deleteDocuments, OwnedDocument, toOwnedDocuments} from './helpers.ts';
import {PasskeyUserId} from './users.ts';

export interface SesamePublicKeyCredential {
  id: Base64URLString;
  passkeyUserId: PasskeyUserId;
  name?: string;
  // User visible identifier.
  credentialPublicKey: Base64URLString; // public key,
  credentialType: string; // type of credential,
  counter?: number; // previous counter,
  aaguid: string; // AAGUID,
  providerIcon?: string; // Provider icon
  userVerified: boolean; // user verifying authenticator,
  // List of transports. SimpleWebAuthn v14 types transports as `string[]`
  // (it no longer exports `AuthenticatorTransportFuture`).
  transports: string[];
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

  /**
   * Deletes all passkeys that belong to the given passkey user ID.
   *
   * This is part of deleting an account: passkeys stored on the server must
   * not outlive the account they were registered for.
   *
   * @param passkey_user_id - The passkey user ID of the account.
   * @returns A promise that resolves to the number of deleted passkeys.
   */
  static async deleteByPasskeyUserId(
    passkey_user_id: PasskeyUserId = ''
  ): Promise<number> {
    // Never run the query with an empty ID. It must not match anything.
    if (!passkey_user_id) {
      return 0;
    }
    const snapshot = await store
      .collection(PublicKeyCredentials.collection)
      .where('passkeyUserId', '==', passkey_user_id)
      .get();
    return deleteDocuments(snapshot.docs.map(doc => doc.ref));
  }

  /**
   * Lists passkeys along with the passkey user ID of the account that owns
   * them, so that passkeys whose account no longer exists can be detected.
   *
   * Only the fields required for that are loaded. Passkeys without a passkey
   * user ID are left out, as it's unknown which account they belong to.
   *
   * @param registered_before - Only passkeys registered before this time (epoch
   *   milliseconds) are listed. During a passkey sign-up, the passkey is stored
   *   right before its account is created, so a freshly registered passkey may
   *   legitimately have no account yet.
   * @returns A promise that resolves to the list of passkey references.
   */
  static async listOwnedDocuments(
    registered_before: number
  ): Promise<OwnedDocument[]> {
    const snapshot = await store
      .collection(PublicKeyCredentials.collection)
      .select('passkeyUserId', 'registeredAt')
      .get();
    const docs = snapshot.docs.filter(doc => {
      const registeredAt: unknown = doc.get('registeredAt');
      // Legacy passkeys without a registration time can't be brand new.
      return (
        typeof registeredAt !== 'number' || registeredAt < registered_before
      );
    });
    return toOwnedDocuments(docs, 'passkeyUserId');
  }
}
