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
import {Timestamp} from 'firebase-admin/firestore';

import {
  deleteDocuments,
  generateRandomString,
  getGravatarUrl,
} from '~project-sesame/server/libs/helpers.ts';
import {config} from '~project-sesame/server/config.ts';
import {
  getTime,
  ALLOW_LISTED_FOREVER,
} from '~project-sesame/server/middlewares/common.ts';
import {PublicKeyCredentials} from '~project-sesame/server/libs/public-key-credentials.ts';
import {store} from '~project-sesame/server/config.ts';
import {FederationMappings} from './federation-mappings.ts';
import {sessionStore} from '~project-sesame/server/libs/custom-firestore-session.ts';
import {logger} from '~project-sesame/server/libs/logger.ts';

export type UserId = Base64URLString;
export type PasskeyUserId = Base64URLString;

/**
 * How long (in milliseconds) a passkey may exist without an account before
 * it's considered orphaned.
 *
 * During a passkey sign-up, the passkey is stored right before its account is
 * created, so a passkey that was registered moments ago may legitimately have
 * no account yet. The grace period keeps such passkeys from being swept away.
 */
const PASSKEY_ORPHAN_GRACE_PERIOD = 1000 * 60 * 10;

/**
 * Interface representing a user as stored in Firestore.
 */
export interface UserInFirestore {
  id: UserId;
  username: string;
  displayName?: string;
  email?: string;
  picture?: string;
  password?: string;
  passkeyUserId?: PasskeyUserId;
  registeredAt: Timestamp | number;
  expiresAt: Timestamp | number;
  approved_clients: string[];
}

/**
 * Interface representing a user for use within the application.
 */
export interface User {
  id: UserId;
  username: string;
  displayName?: string;
  email?: string;
  picture?: string;
  password?: string;
  passkeyUserId?: PasskeyUserId;
  registeredAt: number;
  expiresAt: number;
  approved_clients: string[];
}

/**
 * Converts a UserInFirestore object (as retrieved from the database) to a User object
 * used throughout the application.
 *
 * This function handles the conversion of `registeredAt` and `expiresAt` fields,
 * which may be stored as either Firestore Timestamps or legacy numbers.
 * The application logic expects these fields as numbers (Unix timestamps in ms).
 *
 * @param user - The user object from Firestore.
 * @returns The converted user object with numeric timestamps.
 */
function toUser(user: UserInFirestore): User {
  return {
    ...user,
    // Convert Firestore Timestamp to numeric ms, or use numeric ms directly if it's legacy data.
    registeredAt:
      typeof user.registeredAt === 'number'
        ? user.registeredAt
        : user.registeredAt.toMillis(),
    expiresAt:
      typeof user.expiresAt === 'number'
        ? user.expiresAt
        : user.expiresAt.toMillis(),
  };
}

/**
 * Converts a User object used in the application to a UserInFirestore object
 * suitable for database storage.
 *
 * The application uses numeric timestamps, but we prefer storing them as
 * Firestore Timestamp objects for better querying and TTL support in the database.
 *
 * @param user - The user object to convert.
 * @returns The converted user object with Firestore Timestamps.
 */
function toFirestoreUser(user: User): UserInFirestore {
  return {
    ...user,
    // Always store as Firestore Timestamp to maintain consistency in the DB.
    registeredAt: Timestamp.fromMillis(user.registeredAt),
    expiresAt: Timestamp.fromMillis(user.expiresAt),
  };
}

/**
 * Interface for user information during the sign-up process.
 */
export interface SignUpUser {
  username: string;
  passkeyUserId?: PasskeyUserId;
  displayName?: string;
  email?: string;
  picture?: string;
  password?: string;
}

/**
 * Generates a unique passkey user ID.
 *
 * This ID is used as the `user.id` field in the WebAuthn authentication/registration protocols.
 * It is a random string that should not contain personally identifiable information (PII).
 *
 * @returns The generated passkey user ID as a Base64URLString.
 */
export function generatePasskeyUserId(): Base64URLString {
  return generateRandomString();
}

/**
 * Class for managing user accounts in Firestore.
 */
export class Users {
  static collection = 'users';

  /**
   * Validates if the given username meets the required format.
   *
   * We restrict characters to a safe set of alphanumeric and common symbols
   * to prevent injection attacks and ensure compatibility with various systems.
   *
   * @param username - The username to validate.
   * @returns True if the username is valid, false otherwise.
   */
  static isValidUsername(username: string): boolean {
    // TODO: Detremine the allowed username pattern
    return !!username && /^[a-zA-Z0-9@.\-_]+$/.test(username);
  }

  /**
   * Validates if the given password meets the required format.
   *
   * Similar to username validation, we rely on a safe character set.
   * Proper strength requirements should be implemented based on security best practices.
   *
   * @param password - The password to validate.
   * @returns True if the password is valid, false otherwise.
   */
  static isValidPassword(password: string): boolean {
    // TODO: Follow the best practice to detremine the password strength
    return !!password && /^[a-zA-Z0-9@.\-_]+$/.test(password);
  }

  /**
   * Creates a new user.
   * @param username - The username for the new user.
   * @param options - Optional user information.
   * @returns A promise that resolves to the created user.
   */
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

    // Calculate registration time and expiration time based on account type.
    const registeredAt = getTime();
    let expiresAt: number;
    if (config.allowlisted_accounts.includes(username)) {
      // Allowlisted accounts are kept for a much longer duration.
      expiresAt = getTime(ALLOW_LISTED_FOREVER);
    } else {
      // Standard accounts are evicted after the configured retention duration.
      expiresAt = getTime(config.account_retention_duration);
    }

    // TODO: Check duplicates
    const user: User = {
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

  /**
   * Finds a user by their unique User ID.
   *
   * @param user_id - The ID of the user to find (Base64URLString).
   * @returns A promise that resolves to the User object if found, or undefined otherwise.
   */
  static async findById(user_id: Base64URLString): Promise<User | undefined> {
    const doc = await store.collection(Users.collection).doc(user_id).get();
    if (doc.exists) {
      // Ensure the retrieved data is converted to the app-internal User format.
      return toUser(<UserInFirestore>doc.data());
    } else {
      return;
    }
  }

  /**
   * Finds a user by their unique passkey User ID.
   *
   * This is used during the WebAuthn authentication flow to map a passkey's
   * internal user ID back to our local user account.
   *
   * @param passkey_user_id - The passkey user ID (Base64URLString).
   * @returns A promise that resolves to the User object if found, or undefined otherwise.
   */
  static async findByPasskeyUserId(
    passkey_user_id: Base64URLString
  ): Promise<User | undefined> {
    const results: User[] = [];
    // Search the 'users' collection for a document matching the passkeyUserId field.
    const refs = await store
      .collection(Users.collection)
      .where('passkeyUserId', '==', passkey_user_id)
      .get();
    if (refs) {
      // Convert all matching documents to the app-internal User format.
      refs.forEach(user => results.push(toUser(<UserInFirestore>user.data())));
    }
    // We expect passkeyUserId to be unique per user.
    return results.length > 0 ? results[0] : undefined;
  }

  /**
   * Finds a user by their unique username.
   *
   * @param username - The username to search for.
   * @returns A promise that resolves to the User object if found, or undefined otherwise.
   */
  static async findByUsername(username: string): Promise<User | undefined> {
    const results: User[] = [];
    const refs = await store
      .collection(Users.collection)
      .where('username', '==', username)
      .get();
    if (refs) {
      // Firestore results need to be converted to the app-internal User format.
      refs.forEach(user => results.push(toUser(<UserInFirestore>user.data())));
    }
    return results.length > 0 ? results[0] : undefined;
  }

  /**
   * Sets or updates the password for a specific user.
   *
   * This is currently used for traditional password-based authentication.
   *
   * @param username - The username of the user to update.
   * @param password - The new password (plain text as of now, hashing is pending).
   * @returns A promise that resolves to the updated User object if found, or undefined otherwise.
   */
  static async setPassword(
    username: string,
    password: string
  ): Promise<User | undefined> {
    // Look up the user by username first to ensure they exist.
    const user = await Users.findByUsername(username);
    if (user) {
      // TODO: Hash the password before storing it to protect user credentials.
      user.password = password;
      return Users.update(user);
    }
    return;
  }

  /**
   * Validates a user's password for authentication.
   *
   * This method verifies the provided credentials against the stored user data.
   * Currently, it also supports a fallback mechanism for development/testing.
   *
   * @param username - The username of the user attempting to log in.
   * @param password - The password provided by the user.
   * @returns A promise that resolves to the User object if validation succeeds, or undefined if it fails.
   */
  static async validatePassword(
    username: string,
    password: string
  ): Promise<User | undefined> {
    const user = await Users.findByUsername(username);
    if (user) {
      // TODO: Compare the provided password with the stored hash.
      if (user?.password === password) {
        return user;
      }
      // FIXME: Temporarily allow login without a valid password to simplify development.
      return user;
    } else {
      // FIXME: Temporarily auto-create a user if they don't exist to speed up testing.
      return Users.create(username, {password});
    }
    return;
  }

  /**
   * Updates a user's information in Firestore.
   *
   * This method automatically converts the Numeric timestamps in the `User` object
   * back to Firestore `Timestamp` objects for storage.
   *
   * @param user - The User object with updated information.
   * @returns A promise that resolves to the updated User (application format).
   */
  static async update(user: User): Promise<User> {
    const ref = store
      .collection(Users.collection)
      .doc(<Base64URLString>user.id);
    // Convert to Firestore format before saving.
    await ref.set(toFirestoreUser(user));
    return user;
  }

  /**
   * Deletes a user account and all of its associated data.
   *
   * Besides the user document, this removes the account's passkeys stored on
   * the server, its federation mappings and every session it's signed in with,
   * which signs the user out of all devices. Nothing that refers to the account
   * is supposed to outlive it.
   *
   * @param user_id - The unique ID of the user to delete (Base64URLString).
   * @returns A promise that resolves when all related data has been deleted.
   * @throws If the user doesn't exist or any of the data couldn't be deleted.
   */
  static async delete(user_id: Base64URLString): Promise<void> {
    const user = await Users.findById(user_id);
    if (!user) {
      throw new Error('User not found.');
    }
    await Users.deleteAccount(user);
  }

  /**
   * Deletes accounts that have expired, along with all of their associated
   * data, and then deletes data whose account no longer exists.
   *
   * Accounts are selected by `expiresAt` rather than by `registeredAt`, so
   * that allowlisted accounts, which expire far in the future, are kept.
   *
   * @returns A promise that resolves when the eviction process is complete.
   */
  static async deleteOldUsers(): Promise<void> {
    logger.info('Expired account eviction started...');
    const now = getTime();
    const snapshot = await store
      .collection(Users.collection)
      .where('expiresAt', '<=', Timestamp.fromMillis(now))
      .get();
    const expired = snapshot.docs;
    for (const doc of expired) {
      await Users.deleteAccount({
        id: doc.id,
        username: doc.get('username'),
        passkeyUserId: doc.get('passkeyUserId'),
      });
    }
    const orphans = await Users.deleteOrphanedData();
    logger.info('Eviction ended successfully.', {
      expiredAccounts: expired.length,
      orphanedDocuments: orphans,
    });
  }

  /**
   * Deletes passkeys, sessions and federation mappings whose account no longer
   * exists.
   *
   * Accounts aren't always deleted through `Users.delete()`. In production,
   * the Firestore TTL policy on `expiresAt` evicts them, which only removes
   * the user document itself. This catches whatever such evictions, or a
   * deletion that failed midway, left behind.
   *
   * The candidates are listed before the accounts are. Associated data is only
   * written once its account exists, so data listed first can't be mistaken
   * for an orphan because its account was created in the meantime. The
   * exception is a passkey registered during a sign-up, which is stored right
   * before its account is created, so recent passkeys get a grace period.
   *
   * @returns A promise that resolves to the number of deleted documents.
   */
  static async deleteOrphanedData(): Promise<number> {
    const [passkeys, sessions, mappings] = await Promise.all([
      PublicKeyCredentials.listOwnedDocuments(
        getTime(-PASSKEY_ORPHAN_GRACE_PERIOD)
      ),
      sessionStore.listOwnedDocuments(),
      FederationMappings.listOwnedDocuments(),
    ]);
    const users = await store
      .collection(Users.collection)
      .select('passkeyUserId')
      .get();
    const userIds = new Set<unknown>(users.docs.map(doc => doc.id));
    const passkeyUserIds = new Set<unknown>(
      users.docs.map(doc => doc.get('passkeyUserId'))
    );
    const orphans = [
      ...passkeys.filter(({ownerId}) => !passkeyUserIds.has(ownerId)),
      ...sessions.filter(({ownerId}) => !userIds.has(ownerId)),
      ...mappings.filter(({ownerId}) => !userIds.has(ownerId)),
    ];
    return deleteDocuments(orphans.map(({ref}) => ref));
  }

  /**
   * Deletes an account along with all of its associated data.
   *
   * The associated data is deleted before the user document. If anything
   * fails midway, the account still exists and deleting it can simply be
   * retried, instead of leaving data behind that no account refers to.
   *
   * @param user - The account to delete.
   * @returns A promise that resolves when the account and its data are gone.
   */
  private static async deleteAccount(
    user: Pick<User, 'id' | 'username' | 'passkeyUserId'>
  ): Promise<void> {
    const [passkeys, sessions, mappings] = await Promise.all([
      PublicKeyCredentials.deleteByPasskeyUserId(user.passkeyUserId),
      sessionStore.destroyAllByUserId(user.id),
      FederationMappings.deleteByUserId(user.id),
    ]);
    await store.collection(Users.collection).doc(user.id).delete();
    // The username goes into the structured data, which the logger redacts
    // outside of debugging.
    logger.info('The user account has been deleted along with its data.', {
      userId: user.id,
      username: user.username,
      passkeys,
      sessions,
      federationMappings: mappings,
    });
  }
}
