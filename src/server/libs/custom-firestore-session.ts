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
import {config} from '../config.ts';
import {FirestoreStore, StoreOptions} from '@google-cloud/connect-firestore';

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

    this.db
      .collection(this.kind)
      .doc(sid)
      .set(
        {
          ...sess,
          expiresAt,
        },
        {merge: true}
      )
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
}
