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

import {Base64URLString} from '@simplewebauthn/server';

import {
  generateRandomString,
  getGravatarUrl,
} from '~project-sesame/server/libs/helpers.ts';
import {PublicKeyCredentials} from '~project-sesame/server/libs/public-key-credentials.ts';
import {store} from '~project-sesame/server/config.ts';

export type UserId = Base64URLString;
export type PasskeyUserId = Base64URLString;

export interface User {
  id: UserId;
  username: string;
  displayName?: string;
  email?: string;
  picture?: string;
  password?: string;
  passkeyUserId?: PasskeyUserId;
}

/**
 * Generates a passkey user ID.
 * @returns The generated passkey user ID as a Base64URLString.
 */
export function generatePasskeyUserId(): Base64URLString {
  return generateRandomString();
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
      passkeyUserId?: string;
    } = {}
  ): Promise<User> {
    const {password} = options;
    // TODO: Examine why gravatar is not registered.
    let {
      picture = getGravatarUrl(username),
      displayName = username,
      email = username,
      passkeyUserId: passkey_user_id = generatePasskeyUserId(),
    } = options;

    // TODO: Check duplicates
    const user = {
      id: generateRandomString(),
      username,
      picture,
      displayName,
      email,
      passkeyUserId: passkey_user_id,
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

  static async findByPasskeyUserId(
    passkey_user_id: Base64URLString
  ): Promise<User | undefined> {
    const results: User[] = [];
    const refs = await store
      .collection(Users.collection)
      .where('passkeyUserId', '==', passkey_user_id)
      .get();
    if (refs) {
      refs.forEach(user => results.push(<User>user.data()));
    }
    return results.length > 0 ? results[0] : undefined;
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

  static async setPassword(
    username: string,
    password: string
  ): Promise<User | undefined> {
    const user = await Users.findByUsername(username);
    if (user) {
      // TODO: Hash the password
      user.password = password;
      return Users.update(user);
    }
    return;
  }

  static async validatePassword(
    username: string,
    password: string
  ): Promise<User | undefined> {
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

  static async delete(user_id: Base64URLString): Promise<void> {
    const user = await Users.findById(user_id);
    const passkey_user_id = user?.passkeyUserId;
    if (passkey_user_id) {
      PublicKeyCredentials.deleteByPasskeyUserId(passkey_user_id);
      console.log(`Passkeys for ${user.username} have been deleted.`);
      const doc = await store
        .collection(Users.collection)
        .doc(user_id)
        .delete();
      console.log(`The user account "${user.username}" has been deleted.`);
      return;
    } else {
      throw new Error('Invalid passkey_user_id.');
    }
  }
}
