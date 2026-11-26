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
import {IdentityProvider, IdentityProviders} from './identity-providers.ts';

describe('IdentityProviders', () => {
  let originalIdps: IdentityProvider[];

  const sampleIdp: IdentityProvider = {
    name: 'Sample IdP',
    origin: 'https://idp.example.com',
    configURL: 'https://idp.example.com/fedcm/config.json',
    clientId: 'https://rp.example.com',
    secret: 'idp-secret-value',
  };

  beforeEach(() => {
    originalIdps = [...IdentityProviders.idps];
    IdentityProviders.idps = [sampleIdp];
  });

  afterEach(() => {
    IdentityProviders.idps = originalIdps;
  });

  it('finds a registered IdP by full HTTP(S) origin and returns a defensive clone', async () => {
    const found = await IdentityProviders.findByOrigin(
      'https://idp.example.com/fedcm/config.json'
    );
    assert.deepStrictEqual(found, sampleIdp);

    if (found) {
      found.secret = 'mutated';
    }
    const foundAgain = await IdentityProviders.findByOrigin(
      'https://idp.example.com'
    );
    assert.strictEqual(foundAgain?.secret, 'idp-secret-value');
  });

  it('returns undefined without throwing on malformed, non-HTTP(S), or non-string URLs', async () => {
    assert.strictEqual(
      await IdentityProviders.findByOrigin('http://idp.example.com'),
      undefined
    );
    assert.strictEqual(
      await IdentityProviders.findByOrigin('not-a-valid-url'),
      undefined
    );
    assert.strictEqual(await IdentityProviders.findByOrigin('null'), undefined);
    assert.strictEqual(await IdentityProviders.findByOrigin(''), undefined);
    assert.strictEqual(await IdentityProviders.findByOrigin(123), undefined);
  });
});
