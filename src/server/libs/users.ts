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
import { Timestamp } from 'firebase-admin/firestore';

import {
  generateRandomString,
  getGravatarUrl,
} from '~project-sesame/server/libs/helpers.ts';
import {config} from '~project-sesame/server/config.ts';
import { getTime, ALLOW_LISTED_FOREVER } from '~project-sesame/server/middlewares/common.ts';
import {PublicKeyCredentials} from '~project-sesame/server/libs/public-key-credentials.ts';
import {store} from '~project-sesame/server/config.ts';
import {FederationMappings} from './federation-mappings.ts';
import { logger } from '~project-sesame/server/libs/logger.ts';

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
  registeredAt: Timestamp;
  expiresAt: Timestamp;
  approved_clients: string[];
}

export interface SignUpUser {
  username: string;
  passkeyUserId?: PasskeyUserId;
  displayName?: string;
  email?: string;
  picture?: string;
  password?: string;
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
    const {
      picture = getGravatarUrl(username),
      displayName = username,
      email = username,
      passkeyUserId: passkey_user_id = generatePasskeyUserId(),
    } = options;

    const registeredAt = Timestamp.fromMillis(getTime());
    let expiresAt: Timestamp;
    if (config.allowlisted_accounts.includes(username)) {
      expiresAt = Timestamp.fromMillis(getTime(ALLOW_LISTED_FOREVER));
    } else {
      expiresAt = Timestamp.fromMillis(getTime(config.account_retention_duration));
    }

    // TODO: Check duplicates
    const user = {
      id: generateRandomString(),
      username,
      picture,
      displayName,
      email,
      passkeyUserId: passkey_user_id,
      registeredAt,
      expiresAt,
      approved_clients: [],
    };
    await Users.update(user);
    if (password) {
      await Users.setPassword(username, password);
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

  /**
   * Delete the specified user entry in the database, along with associated
   * federation mappings and public key credential entries
   * @param user_id
   * @returns
   */
  static async delete(user_id: Base64URLString): Promise<void> {
    const user = await Users.findById(user_id);
    if (!user) {
      throw new Error('User not found.');
    }
    logger.info(`Federation mapping is being deleted for ${user.username}.`);
    await FederationMappings.deleteByUserId(user.id);

    const passkey_user_id = user?.passkeyUserId;
    if (passkey_user_id) {
      logger.info(`Passkeys are being deleted for ${user.username}.`);
      await PublicKeyCredentials.deleteByPasskeyUserId(passkey_user_id);
    }

    logger.info(`The user account "${user.username}" has been deleted.`);
    await store.collection(Users.collection).doc(user_id).delete();
    return;
  }

  /**
   * Delete users who registered more than two days ago.
   * @returns
   */
  static async deleteOldUsers(): Promise<void> {
    logger.info('All users eviction started...');
    const retentionDuration = new Date(Date.now() - config.account_retention_duration);
    const users = await store
      .collection(Users.collection)
      .where('registeredAt', '<', Timestamp.fromDate(retentionDuration))
      .get();
    for (const user of users.docs) {
      await Users.delete(user.id);
    }
    logger.info('Eviction ended successfully.');
    return;
  }
}
