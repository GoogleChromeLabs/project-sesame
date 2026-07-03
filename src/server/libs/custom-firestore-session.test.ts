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

import {describe, it, beforeEach, before} from 'node:test';
import assert from 'node:assert';
import net from 'node:net';
import {CustomFirestoreStore} from './custom-firestore-session.js';
import {store, config} from '../config.js';
import {ALLOW_LISTED_FOREVER} from '../middlewares/common.js';

const checkEmulatorReady = (): Promise<boolean> => {
  return new Promise(resolve => {
    const hostPort = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
    const [host, portStr] = hostPort.split(':');
    const port = parseInt(portStr, 10);

    const socket = net.connect({port, host, timeout: 1000}, () => {
      socket.end();
      resolve(true);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
};

describe('CustomFirestoreStore', () => {
  let sessionStore: CustomFirestoreStore;

  before(async () => {
    const ready = await checkEmulatorReady();
    if (!ready) {
      console.error(
        '\n================================================================'
      );
      console.error('ERROR: Firebase Firestore Emulator is not running!');
      console.error(
        "Please start the emulator (e.g., by running 'npm run dev:local')"
      );
      console.error(
        `and ensure it is listening on ${process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081'}.`
      );
      console.error(
        '================================================================\n'
      );
      process.exit(1);
    }
  });

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

  it('should save and retrieve session data using set and get', async () => {
    const sid = `sid-test-${Date.now()}`;
    const sessionData = {
      cookie: {originalMaxAge: 3600},
      user: {id: 'user-123', username: 'normaluser'},
      foo: 'bar',
    };

    try {
      await setSession(sid, sessionData);

      const retrieved = await getSession(sid);
      assert.ok(retrieved, 'Session should be retrieved');
      assert.strictEqual(retrieved.foo, 'bar');
      assert.deepStrictEqual(retrieved.user, sessionData.user);
      assert.ok(retrieved.expiresAt, 'Session should have expiresAt');
    } finally {
      await destroySession(sid).catch(() => {});
    }
  });

  it('should compute standard expiration date for non-allowlisted accounts', async () => {
    const sid = `sid-normal-${Date.now()}`;
    const sessionData = {
      user: {id: 'user-normal', username: 'normaluser'},
    };

    try {
      const before = Date.now();
      await setSession(sid, sessionData);
      const after = Date.now();

      const retrieved = await getSession(sid);
      assert.ok(retrieved);

      // Standard expiration should be config.long_session_duration (which is 48h)
      const expectedExpiresAtMin = before + config.long_session_duration;
      const expectedExpiresAtMax = after + config.long_session_duration;

      assert.ok(
        retrieved.expiresAt >= expectedExpiresAtMin,
        `expiresAt (${retrieved.expiresAt}) should be >= expected min (${expectedExpiresAtMin})`
      );
      assert.ok(
        retrieved.expiresAt <= expectedExpiresAtMax,
        `expiresAt (${retrieved.expiresAt}) should be <= expected max (${expectedExpiresAtMax})`
      );
    } finally {
      await destroySession(sid).catch(() => {});
    }
  });

  it('should compute far-future expiration date for allowlisted accounts', async () => {
    const testUsername = `allowlisted-${Date.now()}`;
    config.allowlisted_accounts.push(testUsername);

    const sid = `sid-allowlisted-${Date.now()}`;
    try {
      const sessionData = {
        user: {id: 'user-allowlisted', username: testUsername},
      };

      const before = Date.now();
      await setSession(sid, sessionData);
      const after = Date.now();

      const retrieved = await getSession(sid);
      assert.ok(retrieved);

      const expectedExpiresAtMin = before + ALLOW_LISTED_FOREVER;
      const expectedExpiresAtMax = after + ALLOW_LISTED_FOREVER;

      assert.ok(
        retrieved.expiresAt >= expectedExpiresAtMin,
        `expiresAt (${retrieved.expiresAt}) should be >= expected min (${expectedExpiresAtMin})`
      );
      assert.ok(
        retrieved.expiresAt <= expectedExpiresAtMax,
        `expiresAt (${retrieved.expiresAt}) should be <= expected max (${expectedExpiresAtMax})`
      );
    } finally {
      // Clean up session
      await destroySession(sid).catch(() => {});
      // Clean up the modified config
      const index = config.allowlisted_accounts.indexOf(testUsername);
      if (index !== -1) {
        config.allowlisted_accounts.splice(index, 1);
      }
    }
  });

  it('should delete only the specified session when destroy is called', async () => {
    const userId = `user-target-${Date.now()}`;
    const otherUserId = `other-user-${Date.now()}`;

    const sid1 = `sid1-target-${Date.now()}`;
    const sid2 = `sid2-target-${Date.now()}`;
    const sidOther = `sid-other-${Date.now()}`;

    try {
      // 1. Create multiple sessions for the same user
      await setSession(sid1, {user: {id: userId, username: 'testuser'}});
      await setSession(sid2, {user: {id: userId, username: 'testuser'}});

      // 2. Create a session for a different user
      await setSession(sidOther, {
        user: {id: otherUserId, username: 'otheruser'},
      });

      // Verify all sessions exist initially
      assert.ok(await getSession(sid1), 'sid1 should exist');
      assert.ok(await getSession(sid2), 'sid2 should exist');
      assert.ok(await getSession(sidOther), 'sidOther should exist');

      // Destroy sid1 (should ONLY delete sid1, and not touch sid2 despite having same user.id)
      await destroySession(sid1);

      // Verify sid1 is deleted
      assert.strictEqual(
        await getSession(sid1),
        undefined,
        'sid1 should be deleted'
      );

      // Verify sid2 and sidOther still exist
      assert.ok(await getSession(sid2), 'sid2 should still exist');
      assert.ok(await getSession(sidOther), 'sidOther should still exist');
    } finally {
      // Clean up remaining sessions
      await destroySession(sid1).catch(() => {});
      await destroySession(sid2).catch(() => {});
      await destroySession(sidOther).catch(() => {});
    }
  });
});
