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

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Users } from './users.js';
import { store } from '../config.js';

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
