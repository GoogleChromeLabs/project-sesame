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
import {
  CredentialAlreadyExistsError,
  PublicKeyCredentials,
  SesamePublicKeyCredential,
} from './public-key-credentials.ts';
import {generateRandomString} from './helpers.ts';
import {getTime} from '../middlewares/common.ts';

/**
 * Builds a minimal passkey credential fixture for Firestore persistence tests.
 */
function buildCredential(
  overrides: Partial<SesamePublicKeyCredential> = {}
): SesamePublicKeyCredential {
  return {
    id: `cred-${generateRandomString()}`,
    passkeyUserId: `user-${generateRandomString()}`,
    name: 'Test passkey',
    credentialPublicKey: `pubkey-${generateRandomString()}`,
    credentialType: 'public-key',
    aaguid: '00000000-0000-0000-0000-000000000000',
    transports: ['internal'],
    userVerified: true,
    credentialDeviceType: 'multiDevice',
    credentialBackedUp: true,
    registeredAt: getTime(),
    ...overrides,
  };
}

describe('PublicKeyCredentials', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdIds.splice(0).map(id => PublicKeyCredentials.remove(id))
    );
  });

  it('creates and retrieves a credential by ID', async () => {
    const credential = buildCredential();
    createdIds.push(credential.id);

    await PublicKeyCredentials.create(credential);

    const stored = await PublicKeyCredentials.findById(credential.id);
    assert.deepStrictEqual(stored, credential);
  });

  it('returns undefined when looking up a missing or empty credential ID', async () => {
    assert.strictEqual(
      await PublicKeyCredentials.findById(`missing-${generateRandomString()}`),
      undefined
    );
    assert.strictEqual(await PublicKeyCredentials.findById(''), undefined);
  });

  it('rejects creating a credential with an empty ID', async () => {
    const credential = buildCredential({id: ''});
    await assert.rejects(
      () => PublicKeyCredentials.create(credential),
      /Credential ID is required\./
    );
  });

  it('rejects duplicate credential IDs and preserves the existing record', async () => {
    const victimCredential = buildCredential({
      passkeyUserId: 'victim-user',
      credentialPublicKey: 'victim-public-key',
      name: 'Victim passkey',
    });
    createdIds.push(victimCredential.id);
    await PublicKeyCredentials.create(victimCredential);

    const attackerCredential = buildCredential({
      id: victimCredential.id,
      passkeyUserId: 'attacker-user',
      credentialPublicKey: 'attacker-public-key',
      name: 'Attacker passkey',
    });

    await assert.rejects(
      () => PublicKeyCredentials.create(attackerCredential),
      error => error instanceof CredentialAlreadyExistsError
    );

    const stored = await PublicKeyCredentials.findById(victimCredential.id);
    assert.deepStrictEqual(stored, victimCredential);
  });

  it('allows only one create under concurrent writes for the same credential ID', async () => {
    const sharedId = `race-cred-${generateRandomString()}`;
    createdIds.push(sharedId);

    const first = buildCredential({
      id: sharedId,
      passkeyUserId: 'user-one',
      credentialPublicKey: 'pubkey-one',
    });
    const second = buildCredential({
      id: sharedId,
      passkeyUserId: 'user-two',
      credentialPublicKey: 'pubkey-two',
    });

    const results = await Promise.allSettled([
      PublicKeyCredentials.create(first),
      PublicKeyCredentials.create(second),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );

    assert.strictEqual(fulfilled.length, 1);
    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof CredentialAlreadyExistsError);

    const stored = await PublicKeyCredentials.findById(sharedId);
    assert.ok(stored);
    assert.ok(
      stored.passkeyUserId === 'user-one' || stored.passkeyUserId === 'user-two'
    );
  });

  it('updates metadata on an existing credential without removing other fields', async () => {
    const credential = buildCredential({name: 'Original passkey'});
    createdIds.push(credential.id);
    await PublicKeyCredentials.create(credential);

    const renamed: SesamePublicKeyCredential = {
      ...credential,
      name: 'Renamed passkey',
      lastUsedAt: getTime(),
    };
    await PublicKeyCredentials.update(renamed);

    const stored = await PublicKeyCredentials.findById(credential.id);
    assert.deepStrictEqual(stored, renamed);
  });
});
