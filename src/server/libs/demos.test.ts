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
import {DEMOS, DEMO_APIS, DEMO_CATEGORIES, getCatalogData} from './demos.js';

describe('getCatalogData', () => {
  it('should return all demos, categories, and APIs when enabledPages is undefined', () => {
    const result = getCatalogData();
    const expectedApis = DEMO_APIS.filter(apiName =>
      DEMOS.some(demo => demo.apis.includes(apiName))
    );

    assert.strictEqual(result.demos.length, DEMOS.length);
    assert.deepStrictEqual(result.categories, DEMO_CATEGORIES);
    assert.deepStrictEqual(result.apis, expectedApis);

    for (const demo of result.demos) {
      assert.strictEqual(demo.categoriesAttr, demo.categories.join(','));
      assert.strictEqual(demo.apisAttr, demo.apis.join(','));
      assert.ok(demo.thumbnail.rows.length > 0);
    }
  });

  it('should filter demos and derive only active categories and APIs when enabledPages is provided', () => {
    const result = getCatalogData(['/signup-form', '/evp-passkey-signup']);

    assert.deepStrictEqual(
      result.demos.map(demo => demo.path),
      ['/signup-form', '/evp-passkey-signup']
    );
    assert.deepStrictEqual(result.categories, ['sign-up', 'ux']);
    assert.deepStrictEqual(result.apis, ['Passkeys', 'EVP', 'Password']);
  });
});
