/*
 * @license
 * Copyright 2026 Google Inc. All rights reserved.
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

import {describe, it, beforeEach} from 'node:test';
import assert from 'node:assert';
import {CustomFirestoreStore} from './custom-firestore-session.js';
import {store} from '../config.js';

describe('CustomFirestoreStore', () => {
  let sessionStore: CustomFirestoreStore;

  beforeEach(() => {
    sessionStore = new CustomFirestoreStore({
      dataset: store,
      kind: 'test_sessions',
    });
  });

  // Helper to promisify store.set
  const setSession = (sid: string, sess: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      sessionStore.set(sid, sess, (err?: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  // Helper to promisify store.get
  const getSession = (sid: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      sessionStore.get(sid, (err?: any, session?: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(session);
        }
      });
    });
  };

  // Helper to promisify store.destroy
  const destroySession = (sid: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      sessionStore.destroy(sid, (err?: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  it('should delete all sessions with the same user ID when destroy is called', async () => {
    const userId = `user-${Date.now()}`;
    const otherUserId = `other-user-${Date.now()}`;

    const sid1 = `sid1-${Date.now()}`;
    const sid2 = `sid2-${Date.now()}`;
    const sid3 = `sid3-${Date.now()}`;
    const sidOther = `sid-other-${Date.now()}`;
    const sidNoUser = `sid-nouser-${Date.now()}`;

    // 1. Create multiple sessions for the target user
    await setSession(sid1, {user: {id: userId, username: 'testuser'}});
    await setSession(sid2, {user: {id: userId, username: 'testuser'}});
    await setSession(sid3, {user: {id: userId, username: 'testuser'}});

    // 2. Create a session for a different user
    await setSession(sidOther, {user: {id: otherUserId, username: 'otheruser'}});

    // 3. Create a session with no user associated
    await setSession(sidNoUser, {someData: 'anonymous'});

    // Verify all sessions exist initially
    assert.ok(await getSession(sid1), 'sid1 should exist');
    assert.ok(await getSession(sid2), 'sid2 should exist');
    assert.ok(await getSession(sid3), 'sid3 should exist');
    assert.ok(await getSession(sidOther), 'sidOther should exist');
    assert.ok(await getSession(sidNoUser), 'sidNoUser should exist');

    // Destroy sid1, which should trigger deletion of sid1, sid2, and sid3
    await destroySession(sid1);

    // Verify sid1, sid2, and sid3 are deleted
    assert.strictEqual(await getSession(sid1), undefined, 'sid1 should be deleted');
    assert.strictEqual(await getSession(sid2), undefined, 'sid2 should be deleted');
    assert.strictEqual(await getSession(sid3), undefined, 'sid3 should be deleted');

    // Verify sidOther and sidNoUser still exist
    assert.ok(await getSession(sidOther), 'sidOther should still exist');
    assert.ok(await getSession(sidNoUser), 'sidNoUser should still exist');

    // Destroy sidNoUser (session with no user ID)
    await destroySession(sidNoUser);
    assert.strictEqual(await getSession(sidNoUser), undefined, 'sidNoUser should be deleted');
    assert.ok(await getSession(sidOther), 'sidOther should still exist');
  });
});
