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

import { getGravatarUrl } from './helpers.mjs';
import { store } from '../config.mjs';
import crypto from 'crypto';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

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
