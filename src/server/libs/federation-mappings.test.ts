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

import {afterEach, describe, it} from 'vitest';
import assert from 'node:assert';
import {FederationMappings} from './federation-mappings.js';
import {generateRandomString} from './helpers.js';

describe('FederationMappings.findByIssuer', () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const userId of createdUserIds) {
      await FederationMappings.deleteByUserId(userId);
    }
    createdUserIds.length = 0;
  });

  it('should scope results to the specified user_id', async () => {
    const issuer = `https://idp-${generateRandomString(6)}.example.com`;
    const otherIssuer = `https://other-${generateRandomString(6)}.example.com`;
    const userA = `user-a-${generateRandomString(8)}`;
    const userB = `user-b-${generateRandomString(8)}`;
    createdUserIds.push(userA, userB);

    await FederationMappings.create(userA, {
      iss: issuer,
      sub: 'sub-user-a',
      email: 'a@example.com',
    });
    await FederationMappings.create(userA, {
      iss: otherIssuer,
      sub: 'sub-user-a-other',
      email: 'a@example.com',
    });

    // User B has not linked `issuer` yet; User A's mapping must not leak to User B.
    const userBMapsBefore = await FederationMappings.findByIssuer(
      issuer,
      userB
    );
    assert.strictEqual(userBMapsBefore.length, 0);

    // User A's mapping for `issuer` is returned when querying for User A.
    const userAMaps = await FederationMappings.findByIssuer(issuer, userA);
    assert.strictEqual(userAMaps.length, 1);
    assert.strictEqual(userAMaps[0].user_id, userA);
    assert.strictEqual(userAMaps[0].sub, 'sub-user-a');

    // Once User B links `issuer`, querying for User B returns only User B's mapping.
    await FederationMappings.create(userB, {
      iss: issuer,
      sub: 'sub-user-b',
      email: 'b@example.com',
    });
    const userBMapsAfter = await FederationMappings.findByIssuer(issuer, userB);
    assert.strictEqual(userBMapsAfter.length, 1);
    assert.strictEqual(userBMapsAfter[0].user_id, userB);
    assert.strictEqual(userBMapsAfter[0].sub, 'sub-user-b');
  });

  it('should return an empty array when url or user_id is empty', async () => {
    const userA = `user-empty-${generateRandomString(8)}`;
    createdUserIds.push(userA);
    await FederationMappings.create(userA, {
      iss: 'https://idp.example.com',
      sub: 'sub-a',
    });

    assert.deepStrictEqual(
      await FederationMappings.findByIssuer('', userA),
      []
    );
    assert.deepStrictEqual(
      await FederationMappings.findByIssuer('https://idp.example.com', ''),
      []
    );
  });
});
