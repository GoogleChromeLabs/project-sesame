import {FOREVER, getTime} from '../middlewares/common.ts';
import {Session, SessionData} from 'express-session';
import {config} from '../config.ts';
import {FirestoreStore, StoreOptions} from '@google-cloud/connect-firestore';

/**
 * Override the Firestore `set` function by adding two additional top-level
 * properties for storing a session: `username` and `expiredAt`.
 * This is to make it easier to query sessions by username and to delete
 * expired sessions.
 *
 * @param sid - The session ID.
 * @param sess - The session object.
 * @param callback - Optional callback function.
 */
export class CustomFirestoreStore extends FirestoreStore {
  constructor(storeOption: StoreOptions) {
    super(storeOption);
  }
  set = async (
    sid: string,
    sess: SessionData,
    callback?: ((err?: Error | undefined) => void) | undefined
  ): Promise<void> => {
    let sessionString: string;
    try {
      sessionString = JSON.stringify(sess);
    } catch (stringifyErr: any) {
      if (typeof callback === 'function') {
        // Pass the error to the callback
        return callback(
          stringifyErr instanceof Error
            ? stringifyErr
            : new Error(String(stringifyErr))
        );
      }
      // If no callback, rethrow the error so it's not swallowed
      throw stringifyErr;
    }

    // The 'user' property is added to the SessionData via module augmentation in types.d.ts
    const username: string | null = (sess as Session)?.user?.username || null;

    // Correctly calculate the expiration Date object.
    // config.long_session_duration is expected to be in milliseconds.
    let expiresAt: number;
    if (config.allowlisted_accounts.includes(username)) {
      expiresAt = getTime(FOREVER);
    } else {
      expiresAt = getTime(config.long_session_duration);
    }

    try {
      await this.db.collection(this.kind).doc(sid).set(
        {
          data: sessionString,
          expiresAt, // This will now be a proper Date object for Firestore
          username,
        },
        {merge: true}
      );

      if (typeof callback === 'function') {
        callback();
      }
    } catch (dbErr: any) {
      if (typeof callback === 'function') {
        callback(dbErr instanceof Error ? dbErr : new Error(String(dbErr)));
      } else {
        // If no callback, log the error. Consider rethrowing if the caller needs to handle it.
        console.error(
          `Firestore set operation failed for session ID ${sid}:`,
          dbErr
        );
        // throw dbErr; // Optionally rethrow
      }
    }
  };
}
