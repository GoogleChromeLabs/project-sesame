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
import {store} from '../config.js';
import {deleteDocuments, toOwnedDocuments} from './helpers.js';

describe('deleteDocuments', () => {
  it('should delete documents that span multiple batches', async () => {
    const collection = store.collection(`test_delete_documents_${Date.now()}`);
    const refs = Array.from({length: 501}, () => collection.doc());
    const writer = store.bulkWriter();
    const writes = refs.map(ref => writer.set(ref, {createdAt: Date.now()}));
    await writer.close();
    await Promise.all(writes);

    const deleted = await deleteDocuments(refs);

    assert.strictEqual(deleted, refs.length);
    const remaining = await collection.get();
    assert.strictEqual(remaining.size, 0);
  });

  it('should do nothing when there are no documents to delete', async () => {
    assert.strictEqual(await deleteDocuments([]), 0);
  });
});

describe('toOwnedDocuments', () => {
  it('should leave out documents without an owner ID', () => {
    const ref = store.collection('test_owned_documents').doc('doc');
    const docWithOwner = (ownerId: unknown) => ({ref, get: () => ownerId});

    const owned = toOwnedDocuments(
      [
        docWithOwner('owner'),
        docWithOwner(undefined),
        docWithOwner(''),
        docWithOwner(42),
      ],
      'user_id'
    );

    assert.deepStrictEqual(
      owned.map(({ownerId}) => ownerId),
      ['owner']
    );
  });
});
