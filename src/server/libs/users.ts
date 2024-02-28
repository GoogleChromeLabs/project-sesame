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

import crypto from 'crypto';
import {isoBase64URL} from '@simplewebauthn/server/helpers';
import {Base64URLString} from '@simplewebauthn/types';

import {getGravatarUrl} from '~project-sesame/server/libs/helpers.ts';
import {store} from '~project-sesame/server/config.ts';

export interface User {
  id: Base64URLString;
  username: string;
  displayName?: string;
  email?: string;
  picture?: string;
  password?: string;
}

export class Users {
  static collection = 'users';

  static isValidUsername(username: string): boolean {
    // TODO: Detremine the allowed username pattern
    return !!username && /^[a-zA-Z0-9@.\-_]+$/.test(username);
  }

  static isValidPassword(password: string): boolean {
    // TODO: Follow the best practice to detremine the password strength
    return !!password && /^[a-zA-Z0-9@.\-_]+$/.test(password);
  }

  static async create(
    username: string,
    options: {
      picture?: string;
      displayName?: string;
      email?: string;
      password?: string;
    } = {}
  ): Promise<User> {
    const {password} = options;
    let {picture, displayName, email} = options;

    // TODO: Examine why gravatar is not registered.
    if (!picture) {
      picture = getGravatarUrl(username);
    }

    if (!displayName) {
      displayName = username;
    }

    if (!email) {
      email = username;
    }

    // TODO: Check duplicates
    const user = {
      id: isoBase64URL.fromBuffer(crypto.randomBytes(32)),
      username,
      picture,
      displayName,
      email,
    };
    await Users.update(user);
    if (password) {
      Users.setPassword(username, password);
    }
    return user;
  }

  static async findById(user_id: Base64URLString): Promise<User | undefined> {
    const doc = await store.collection(Users.collection).doc(user_id).get();
    if (doc) {
      return <User>doc.data();
    } else {
      return;
    }
  }

  static async findByUsername(username: string): Promise<User | undefined> {
    const results: User[] = [];
    const refs = await store
      .collection(Users.collection)
      .where('username', '==', username)
      .get();
    if (refs) {
      refs.forEach(user => results.push(<User>user.data()));
    }
    return results.length > 0 ? results[0] : undefined;
  }

  static async setPassword(username: string, password: string): Promise<User | undefined> {
    const user = await Users.findByUsername(username);
    if (user) {
      // TODO: Hash the password
      user.password = password;
      return Users.update(user);
    }
    return;
  }

  static async validatePassword(username: string, password: string): Promise<User | undefined> {
    const user = await Users.findByUsername(username);
    if (user) {
      // TODO: Validate the password with hash
      if (user?.password === password) {
        return user;
      }
      // FIXME: Temporarily allow login without a valid password
      return user;
    } else {
      // FIXME: Temporarily create a new user if not found.
      return Users.create(username, {password});
    }
    return;
  }

  static async update(user: User): Promise<User> {
    const ref = store
      .collection(Users.collection)
      .doc(<Base64URLString>user.id);
    ref.set(user);
    return user;
  }
}
