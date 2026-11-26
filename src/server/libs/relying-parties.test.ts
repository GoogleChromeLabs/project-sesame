/*
 * @license
 * Copyright 2026 Google LLC
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
 * limitations under the License.
 */

import {afterEach, beforeEach, describe, it} from 'vitest';
import assert from 'node:assert';
import {RelyingParties, RelyingParty} from './relying-parties.ts';

describe('RelyingParties', () => {
  let originalRps: RelyingParty[];

  const sampleRp: RelyingParty = {
    origin: 'https://rp.example.com',
    client_id: 'https://rp.example.com',
    name: 'Example RP',
    secret: 'rp-secret-value',
  };

  beforeEach(() => {
    originalRps = [...RelyingParties.rps];
    RelyingParties.rps = [sampleRp];
  });

  afterEach(() => {
    RelyingParties.rps = originalRps;
  });

  it('finds a registered RP by client_id and returns a defensive clone', async () => {
    const found = await RelyingParties.findByClientID('https://rp.example.com');
    assert.deepStrictEqual(found, sampleRp);

    if (found) {
      found.secret = 'mutated';
    }
    const foundAgain = await RelyingParties.findByClientID(
      'https://rp.example.com'
    );
    assert.strictEqual(foundAgain?.secret, 'rp-secret-value');
  });

  it('returns undefined for unknown, empty, or non-string client_id values', async () => {
    assert.strictEqual(
      await RelyingParties.findByClientID('https://unknown.example.com'),
      undefined
    );
    assert.strictEqual(await RelyingParties.findByClientID(''), undefined);
    assert.strictEqual(await RelyingParties.findByClientID('   '), undefined);
    assert.strictEqual(await RelyingParties.findByClientID(123), undefined);
    assert.strictEqual(
      await RelyingParties.findByClientID(undefined),
      undefined
    );
  });

  it('finds a registered RP by full URL origin and rejects invalid origins', async () => {
    const found = await RelyingParties.findByOrigin('https://rp.example.com/');
    assert.deepStrictEqual(found, sampleRp);

    assert.strictEqual(
      await RelyingParties.findByOrigin('http://rp.example.com'),
      undefined
    );
    assert.strictEqual(
      await RelyingParties.findByOrigin('not-a-valid-url'),
      undefined
    );
    assert.strictEqual(await RelyingParties.findByOrigin('null'), undefined);
    assert.strictEqual(await RelyingParties.findByOrigin(null), undefined);
  });
});
