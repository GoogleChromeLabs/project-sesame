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
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import firebaseJson from '../firebase.json' assert { type: 'json' };
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import crypto from 'crypto';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreStore } from '@google-cloud/connect-firestore';
import { initializeApp } from 'firebase-admin/app';

if (process.env.NODE_ENV === 'localhost') {
  process.env.DOMAIN = 'http://localhost:8080';
  process.env.FIRESTORE_EMULATOR_HOST = `${firebaseJson.emulators.firestore.host}:${firebaseJson.emulators.firestore.port}`;
}

initializeApp();
const store = getFirestore(process.env.FIRESTORE_DATABASENAME);
store.settings({ ignoreUndefinedProperties: true });

/**
 * User data schema
 * {
 *   id: string Base64URL encoded user ID,
 *   username: string username,
 *   displayName: string display name,
 * }
 **/

export const Users = {
  create: async (username) => {
    const user = {
      id: isoBase64URL.fromBuffer(crypto.randomBytes(32)),
      username,
      displayName: username,
    };
    return Users.update(user);
  },

  findById: async (user_id) => {
    const doc = await store.collection(process.env.USERS_COLLECTION).doc(user_id).get();
    if (doc) {
      const credential = doc.data();
      return credential;
    } else {
      return;
    }
  },

  findByUsername: async (username) => {
    const results = [];
    const refs = await store.collection(process.env.USERS_COLLECTION)
      .where('username', '==', username).get();
    if (refs) {
      refs.forEach(user => results.push(user.data()));
    }
    return results.length > 0 ? results[0] : undefined;
  },

  update: async (user) => {
    const ref = store.collection(process.env.USERS_COLLECTION).doc(user.id);
      return ref.set(user);
  }
}

/**
 * User data schema
 * {
 *   id: string Base64URL encoded CredentialID,
 *   publicKey: string Base64URL encoded PublicKey,
 *   name: string name of the credential,
 *   transports: an array of transports,
 *   registered: timestamp,
 *   last_used: timestamp,
 *   user_id: string Base64URL encoded user ID of the owner,
 * }
 **/

export const Credentials = {
  findById: async (credential_id) => {
    const doc = await store.collection(process.env.PUBKEY_CREDS_COLLECTION).doc(credential_id).get();
    if (doc) {
      const credential = doc.data();
      return credential;
    } else {
      return;
    }
  },

  findByUserId: async (user_id) => {
    const results = [];
    const refs = await store.collection(process.env.PUBKEY_CREDS_COLLECTION)
      .where('user_id', '==', user_id)
      .orderBy('registered', 'desc').get();
    refs.forEach(cred => results.push(cred.data()));
    return results;
  },

  update: async (credential) => {
    const ref = store.collection(process.env.PUBKEY_CREDS_COLLECTION).doc(credential.id);
    return ref.set(credential);
  },
  
  remove: async (credential_id, user_id) => {
    const ref = store.collection(process.env.PUBKEY_CREDS_COLLECTION).doc(credential_id);
    return ref.delete();
  }
}

export const SessionStore = new FirestoreStore({
  dataset: store,
  kind: process.env.SESSIONS_COLLECTION,
});
