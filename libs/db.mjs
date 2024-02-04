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
import { store } from '../config.mjs';
import crypto from 'crypto';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { FirestoreStore } from '@google-cloud/connect-firestore';

function getGravatarUrl(username) {
  const pictureURL = new URL('https://www.gravatar.com/');
  pictureURL.pathname = `/avatar/${crypto.createHash('md5').update(username).digest('hex')}`;
  pictureURL.searchParams.append('s', 200);
  return pictureURL.toString();
}

/**
 * User data schema
 * {
 *   id: string Base64URL encoded user ID,
 *   username: string username,
 *   displayName: string display name,
 *   email: string email address,
 *   picture: string avatar image url,
 * }
 **/

export class Users {
  static async create(username, options = {}) {
    let { picture, displayName, email } = options;

    if (!picture) {
      picture = getGravatarUrl(username);
    }

    if (!displayName) {
      displayName = username;
    }

    if (!email) {
      email = username;
    }

    const user = {
      id: isoBase64URL.fromBuffer(crypto.randomBytes(32)),
      username,
      picture,
      displayName,
      email,
    };
    return Users.update(user);
  }

  static async findById(user_id) {
    const doc = await store.collection(process.env.USERS_COLLECTION).doc(user_id).get();
    if (doc) {
      const credential = doc.data();
      return credential;
    } else {
      return;
    }
  }

  static async findByUsername(username) {
    const results = [];
    const refs = await store.collection(process.env.USERS_COLLECTION)
      .where('username', '==', username).get();
    if (refs) {
      refs.forEach(user => results.push(user.data()));
    }
    return results.length > 0 ? results[0] : undefined;
  }

  static async update(user) {
    const ref = store.collection(process.env.USERS_COLLECTION).doc(user.id);
      return ref.set(user);
  }
}

/**
 * Credentials data schema
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

export class Credentials {
  static async findById(credential_id) {
    const doc = await store.collection(process.env.PUBKEY_CREDS_COLLECTION).doc(credential_id).get();
    if (doc) {
      const credential = doc.data();
      return credential;
    } else {
      return;
    }
  }

  static async findByUserId (user_id) {
    const results = [];
    const refs = await store.collection(process.env.PUBKEY_CREDS_COLLECTION)
      .where('user_id', '==', user_id)
      .orderBy('registeredAt', 'desc').get();
    refs.forEach(cred => results.push(cred.data()));
    return results;
  }

  static async update(credential) {
    const ref = store.collection(process.env.PUBKEY_CREDS_COLLECTION).doc(credential.id);
    return ref.set(credential);
  }
  
  static async remove(credential_id, user_id) {
    const ref = store.collection(process.env.PUBKEY_CREDS_COLLECTION).doc(credential_id);
    return ref.delete();
  }
}

export const SessionStore = new FirestoreStore({
  dataset: store,
  kind: process.env.SESSIONS_COLLECTION,
});

/*
  {
    user_id: string
    issuer: string
    subject: string
    name: string
    email: string
    given_name: string
    family_name: string
    picture: string
    issued_at: number
    expires_at: number
  }
*/
export class FederationMappings {
  static async create(user_id, options) {
  }

  static async findByIssuer(url) {
  }

  static async findByUserId(user_id) {
  }
};

export class RelyingParties {
  static rps = [{
    url: 'https://fedcm-rp-demo.glitch.me',
    client_id: 'fedcm-rp-demo',
    name: 'FedCM RP Demo'
  }]

  static async findByClientID(client_id) {
    const rp = RelyingParties.rps.find(rp => rp.client_id === client_id);
    return Promise.resolve(structuredClone(rp));
  }
};

export class IdentityProviders {
  static idps = [{
    origin: 'https://fedcm-idp-demo.glitch.me',
    configURL: 'https://fedcm-idp-demo.glitch.me/fedcm.json',
    clientId: 'https://identity-demos.dev',
    secret: 'xxxxx'
  }]

  static async findByURL(url) {
    const idp = IdentityProviders.idps.find(idp => {
      return idp.origin === (new URL(url)).origin;
    })
    return Promise.resolve(structuredClone(idp));
  }
};
