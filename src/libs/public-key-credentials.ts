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

import { store } from "../config.js";
import {
  Base64URLString,
  CredentialDeviceType,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";

export interface SesamePublicKeyCredential {
  id: Base64URLString;
  user_id: Base64URLString;
  name?: string;
  // User visible identifier.
  credentialPublicKey: Base64URLString; // public key,
  counter?: number; // previous counter,
  aaguid?: string; // AAGUID,
  user_verifying: boolean; // user verifying authenticator,
  transports: AuthenticatorTransportFuture[]; // list of transports,
  browser?: string;
  os?: string;
  platform?: string;
  last_used?: number; // last used epoc time,
  credentialDeviceType?: CredentialDeviceType;
  credentialBackedUp?: boolean;
  registeredAt: number;
}

/**
 * PublicKeyCredentials data schema
 * {
 *   id: string Base64URL encoded CredentialID,
 *   publicKey: string Base64URL encoded PublicKey,
 *   name: string name of the credential,
 *   transports: an array of transports,
 *   registeredAt: timestamp,
 *   last_used: timestamp,
 *   user_id: string Base64URL encoded user ID of the owner,
 * }
 **/

export class PublicKeyCredentials {
  static collection = "public_key_credentials";

  static async findById(
    credential_id: Base64URLString
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

  static async findByUserId(
    user_id: Base64URLString
  ): Promise<SesamePublicKeyCredential[] | undefined> {
    const results: SesamePublicKeyCredential[] = [];
    const refs = await store
      .collection(PublicKeyCredentials.collection)
      .where("user_id", "==", user_id)
      .orderBy("registeredAt", "desc")
      .get();
    refs.forEach((cred) => results.push(<SesamePublicKeyCredential>cred.data()));
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
    credential_id: Base64URLString,
    user_id: Base64URLString
  ): Promise<FirebaseFirestore.WriteResult> {
    const ref = store
      .collection(PublicKeyCredentials.collection)
      .doc(credential_id);
    return ref.delete();
  }
}
