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

import {describe, it} from 'vitest';
import assert from 'node:assert';
import {User, Users} from './users.js';
import {store} from '../config.js';
import {PublicKeyCredentials} from './public-key-credentials.js';
import {FederationMap, FederationMappings} from './federation-mappings.js';
import {SESSIONS_COLLECTION, sessionStore} from './custom-firestore-session.js';
import {generateRandomString} from './helpers.js';
import {getTime} from '../middlewares/common.js';

/**
 * Stores a passkey that belongs to the given passkey user ID. Only the fields
 * that account deletion relies on are set.
 */
async function createPasskey(
  passkeyUserId: string,
  registeredAt: number = getTime()
): Promise<string> {
  const id = generateRandomString();
  await store
    .collection(PublicKeyCredentials.collection)
    .doc(id)
    .set({id, passkeyUserId, registeredAt});
  return id;
}

/**
 * Stores a session through the session store, so that the document has the
 * same shape as the ones the session middleware stores.
 */
function createSession(data: object): Promise<string> {
  const sid = generateRandomString();
  return new Promise((resolve, reject) => {
    sessionStore.set(sid, {cookie: {originalMaxAge: 3600}, ...data}, err =>
      err ? reject(err) : resolve(sid)
    );
  });
}

/**
 * Stores a federation mapping that belongs to the given user.
 */
async function createMapping(user_id: string): Promise<string> {
  const map: FederationMap = {
    iss: 'https://idp.example.com',
    sub: generateRandomString(),
  };
  await FederationMappings.create(user_id, map);
  // `create()` assigns a random ID to the mapping.
  assert.ok(map.id, 'The mapping should have an ID');
  return map.id;
}

/**
 * Checks whether a document exists.
 */
async function exists(collection: string, id: string): Promise<boolean> {
  const doc = await store.collection(collection).doc(id).get();
  return doc.exists;
}

describe('Users', () => {
  it('should create a user with number timestamps', async () => {
    const username = `testuser-create-${Date.now()}`;
    const user = await Users.create(username);
    assert.strictEqual(typeof user.registeredAt, 'number');
    assert.strictEqual(typeof user.expiresAt, 'number');
    assert.ok(user.registeredAt > 0);
    assert.ok(user.expiresAt > user.registeredAt);
  });

  it('should find a user by ID and have number timestamps', async () => {
    const username = `testuser-findid-${Date.now()}`;
    const createdUser = await Users.create(username);
    const foundUser = await Users.findById(createdUser.id);
    assert.ok(foundUser, 'User should be found by ID');
    assert.strictEqual(typeof foundUser!.registeredAt, 'number');
    assert.strictEqual(typeof foundUser!.expiresAt, 'number');
    assert.strictEqual(foundUser!.registeredAt, createdUser.registeredAt);
    assert.strictEqual(foundUser!.expiresAt, createdUser.expiresAt);
  });

  it('should find a user by username and have number timestamps', async () => {
    const username = `testuser-findname-${Date.now()}`;
    const createdUser = await Users.create(username);
    // Give it a tiny bit of time for indexing if needed, though emulator is usually fast
    await new Promise(resolve => setTimeout(resolve, 100));
    const foundUser = await Users.findByUsername(username);
    assert.ok(foundUser, 'User should be found by username');
    assert.strictEqual(typeof foundUser!.registeredAt, 'number');
    assert.strictEqual(typeof foundUser!.expiresAt, 'number');
  });

  it('should update a user and maintain number timestamps', async () => {
    const username = `testuser-update-${Date.now()}`;
    const createdUser = await Users.create(username);
    createdUser.displayName = 'Updated Name';
    const updatedUser = await Users.update(createdUser);
    assert.strictEqual(updatedUser.displayName, 'Updated Name');
    assert.strictEqual(typeof updatedUser.registeredAt, 'number');

    const reFoundUser = await Users.findById(createdUser.id);
    assert.strictEqual(reFoundUser!.displayName, 'Updated Name');
    assert.strictEqual(typeof reFoundUser!.registeredAt, 'number');
  });

  it('should delete a user', async () => {
    const username = `testuser-delete-${Date.now()}`;
    const createdUser = await Users.create(username);
    await Users.delete(createdUser.id);
    const foundUser = await Users.findById(createdUser.id);
    assert.strictEqual(foundUser, undefined);
  });

  it('should accommodate legacy users with number timestamps in Firestore', async () => {
    const legacyUserId = `legacy-user-${Date.now()}`;
    const legacyUser = {
      id: legacyUserId,
      username: legacyUserId,
      registeredAt: Date.now(),
      expiresAt: Date.now() + 10000,
      approved_clients: [],
    };

    // Manually insert with numbers to simulate legacy data
    await store.collection(Users.collection).doc(legacyUserId).set(legacyUser);

    const foundUser = await Users.findById(legacyUserId);
    assert.ok(foundUser, 'Legacy user should be found');
    assert.strictEqual(typeof foundUser!.registeredAt, 'number');
    assert.strictEqual(foundUser!.registeredAt, legacyUser.registeredAt);
    assert.strictEqual(typeof foundUser!.expiresAt, 'number');
    assert.strictEqual(foundUser!.expiresAt, legacyUser.expiresAt);
  });
});

describe('Account deletion', () => {
  it('should delete a user along with all of its associated data', async () => {
    const user = await Users.create(`testuser-cascade-${Date.now()}`);
    const other = await Users.create(`testuser-bystander-${Date.now()}`);
    assert.ok(user.passkeyUserId);
    assert.ok(other.passkeyUserId);

    const passkeys = [
      await createPasskey(user.passkeyUserId),
      await createPasskey(user.passkeyUserId),
    ];
    // The user is signed in on two devices.
    const sessions = [await createSession({user}), await createSession({user})];
    const mapping = await createMapping(user.id);
    const otherPasskey = await createPasskey(other.passkeyUserId);
    const otherSession = await createSession({user: other});
    const otherMapping = await createMapping(other.id);

    await Users.delete(user.id);

    assert.strictEqual(await Users.findById(user.id), undefined);
    for (const id of passkeys) {
      assert.strictEqual(
        await exists(PublicKeyCredentials.collection, id),
        false,
        'Passkeys of the user should be deleted'
      );
    }
    for (const sid of sessions) {
      assert.strictEqual(
        await exists(SESSIONS_COLLECTION, sid),
        false,
        'Sessions of the user should be deleted'
      );
    }
    assert.strictEqual(
      await exists(FederationMappings.collection, mapping),
      false,
      'Federation mappings of the user should be deleted'
    );

    // Data of other accounts must be left untouched.
    assert.ok(await Users.findById(other.id));
    assert.ok(await exists(PublicKeyCredentials.collection, otherPasskey));
    assert.ok(await exists(SESSIONS_COLLECTION, otherSession));
    assert.ok(await exists(FederationMappings.collection, otherMapping));
  });

  it('should fail to delete a user that does not exist', async () => {
    await assert.rejects(
      Users.delete(`nonexistent-${Date.now()}`),
      /User not found/
    );
  });
});

/**
 * Eviction and the orphan sweep act on the entire database. Run them only on
 * the throwaway emulator that `firebase emulators:exec` starts for `npm test`
 * (which sets `FIREBASE_EMULATOR_HUB`), never on a development emulator that
 * holds local data.
 */
const isThrowawayEmulator = !!process.env.FIREBASE_EMULATOR_HUB;

describe.skipIf(!isThrowawayEmulator)('Account eviction', () => {
  it('should evict expired accounts along with their data and keep the others', async () => {
    const expired = await Users.create(`testuser-expired-${Date.now()}`);
    await Users.update({...expired, expiresAt: getTime(-1000)});
    // Registered long ago but not expired, like an allowlisted account.
    const active = await Users.create(`testuser-active-${Date.now()}`);
    await Users.update({
      ...active,
      registeredAt: getTime(-1000 * 60 * 60 * 24 * 30),
    });
    assert.ok(expired.passkeyUserId);
    assert.ok(active.passkeyUserId);

    const expiredPasskey = await createPasskey(expired.passkeyUserId);
    const expiredSession = await createSession({user: expired});
    const expiredMapping = await createMapping(expired.id);
    const activePasskey = await createPasskey(active.passkeyUserId);
    const activeSession = await createSession({user: active});
    const activeMapping = await createMapping(active.id);

    await Users.deleteOldUsers();

    assert.strictEqual(await Users.findById(expired.id), undefined);
    assert.strictEqual(
      await exists(PublicKeyCredentials.collection, expiredPasskey),
      false
    );
    assert.strictEqual(
      await exists(SESSIONS_COLLECTION, expiredSession),
      false
    );
    assert.strictEqual(
      await exists(FederationMappings.collection, expiredMapping),
      false
    );

    assert.ok(await Users.findById(active.id));
    assert.ok(await exists(PublicKeyCredentials.collection, activePasskey));
    assert.ok(await exists(SESSIONS_COLLECTION, activeSession));
    assert.ok(await exists(FederationMappings.collection, activeMapping));
  });

  it('should delete data whose account no longer exists', async () => {
    const user = await Users.create(`testuser-owner-${Date.now()}`);
    assert.ok(user.passkeyUserId);
    // An account that disappeared without its data being deleted, which is
    // what the Firestore TTL policy does.
    const evicted: Pick<User, 'id' | 'username' | 'passkeyUserId'> = {
      id: generateRandomString(),
      username: `testuser-evicted-${Date.now()}`,
      passkeyUserId: generateRandomString(),
    };
    assert.ok(evicted.passkeyUserId);
    const anHourAgo = getTime(-1000 * 60 * 60);

    const ownedPasskey = await createPasskey(user.passkeyUserId, anHourAgo);
    const ownedSession = await createSession({user});
    const ownedMapping = await createMapping(user.id);
    const orphanedPasskey = await createPasskey(
      evicted.passkeyUserId,
      anHourAgo
    );
    const orphanedSession = await createSession({user: evicted});
    const orphanedMapping = await createMapping(evicted.id);
    // A passkey stored during a sign-up, right before its account is created.
    const signUpPasskey = await createPasskey(generateRandomString());
    // A legacy passkey without `passkeyUserId` can't be tied to any account.
    const legacyPasskey = generateRandomString();
    await store
      .collection(PublicKeyCredentials.collection)
      .doc(legacyPasskey)
      .set({
        id: legacyPasskey,
        passkey_user_id: generateRandomString(),
        registeredAt: anHourAgo,
      });
    // A session in the middle of signing in doesn't belong to any account.
    const signingInSession = await createSession({
      signin_username: evicted.username,
    });

    const deleted = await Users.deleteOrphanedData();

    assert.ok(deleted >= 3, `Expected at least 3 deletions, got ${deleted}`);
    assert.strictEqual(
      await exists(PublicKeyCredentials.collection, orphanedPasskey),
      false
    );
    assert.strictEqual(
      await exists(SESSIONS_COLLECTION, orphanedSession),
      false
    );
    assert.strictEqual(
      await exists(FederationMappings.collection, orphanedMapping),
      false
    );

    assert.ok(await exists(PublicKeyCredentials.collection, ownedPasskey));
    assert.ok(await exists(SESSIONS_COLLECTION, ownedSession));
    assert.ok(await exists(FederationMappings.collection, ownedMapping));
    assert.ok(await exists(PublicKeyCredentials.collection, signUpPasskey));
    assert.ok(await exists(PublicKeyCredentials.collection, legacyPasskey));
    assert.ok(await exists(SESSIONS_COLLECTION, signingInSession));
  });
});
