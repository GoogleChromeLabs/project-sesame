/*
 * @license
 * Copyright 2025 Google Inc. All rights reserved.
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

import {ALLOW_LISTED_FOREVER, getTime} from '../middlewares/common.ts';
import {SessionData} from 'express-session';
import {config, store} from '../config.ts';
import {FirestoreStore, StoreOptions} from '@google-cloud/connect-firestore';
import {deleteDocuments, OwnedDocument, toOwnedDocuments} from './helpers.ts';

/**
 * The name of the Firestore collection that sessions are stored in.
 */
export const SESSIONS_COLLECTION = 'sessions';

/**
 * Override the Firestore `set` and `get` functions for storing a session.
 *
 * @param sid - The session ID.
 * @param sess - The session object.
 * @param callback - Optional callback function.
 */
export class CustomFirestoreStore extends FirestoreStore {
  constructor(storeOption: StoreOptions) {
    super(storeOption);
  }
  get = (
    sid: string,
    callback: (err?: any, session?: SessionData) => void
  ): void => {
    this.db
      .collection(this.kind)
      .doc(sid)
      .get()
      .then(doc => {
        if (!doc.exists) {
          return callback();
        }
        return callback(null, doc.data() as SessionData);
      })
      .catch(err => {
        return callback(err);
      });
  };

  set = (sid: string, sess: any, callback?: (err?: any) => void): void => {
    // Correctly calculate the expiration Date object.
    // config.long_session_duration is expected to be in milliseconds.
    let expiresAt: number;
    if (
      sess?.user?.username &&
      config.allowlisted_accounts.includes(sess.user.username)
    ) {
      expiresAt = getTime(ALLOW_LISTED_FOREVER);
    } else {
      expiresAt = getTime(config.long_session_duration);
    }

    // Replace the whole document rather than merging into it. `sess` is the
    // complete session, and merging would keep properties that have been
    // deleted from it (e.g. by `SessionService.resetSigningUp()`).
    this.db
      .collection(this.kind)
      .doc(sid)
      .set({
        ...sess,
        expiresAt,
      })
      .then(() => {
        if (typeof callback === 'function') {
          callback();
        }
      })
      .catch(dbErr => {
        if (typeof callback === 'function') {
          callback(dbErr instanceof Error ? dbErr : new Error(String(dbErr)));
        } else {
          // If no callback, log the error. Consider rethrowing if the caller needs to handle it.
          console.error(
            `Firestore set operation failed for session ID ${sid}:`,
            dbErr
          );
        }
      });
  };

  /**
   * Destroys every session that belongs to the given user.
   *
   * Unlike `destroy()`, which removes a single session (e.g. when the user
   * signs out on one device), this signs the user out of all devices at once.
   * It's used when the account itself is deleted, so that no session keeps
   * holding a copy of a user who no longer exists.
   *
   * This relies on `set()` storing sessions as plain documents rather than as
   * serialized strings, which makes `user.id` queryable.
   *
   * @param userId - The ID of the user whose sessions should be destroyed.
   * @returns A promise that resolves to the number of destroyed sessions.
   */
  async destroyAllByUserId(userId: string): Promise<number> {
    // Never run the query with an empty ID. It must not match anything.
    if (!userId) {
      return 0;
    }
    const snapshot = await this.db
      .collection(this.kind)
      .where('user.id', '==', userId)
      .get();
    return deleteDocuments(snapshot.docs.map(doc => doc.ref));
  }

  /**
   * Lists sessions of signed-in users along with the ID of that user, so that
   * sessions whose account no longer exists can be detected.
   *
   * Sessions without a signed-in user (e.g. in the middle of signing in) don't
   * belong to any account and aren't listed. Only the fields required for that
   * are loaded.
   *
   * @returns A promise that resolves to the list of session references.
   */
  async listOwnedDocuments(): Promise<OwnedDocument[]> {
    const snapshot = await this.db
      .collection(this.kind)
      .where('user.id', '!=', null)
      .select('user.id')
      .get();
    return toOwnedDocuments(snapshot.docs, 'user.id');
  }
}

/**
 * The session store shared by the session middleware and account management.
 * Deleting an account needs to destroy the account's sessions in the same
 * collection that the middleware reads them from.
 */
export const sessionStore = new CustomFirestoreStore({
  dataset: store,
  kind: SESSIONS_COLLECTION,
});
