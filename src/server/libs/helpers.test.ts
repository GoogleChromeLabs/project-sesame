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
import {
  deleteDocuments,
  getRequestContext,
  isAllowedDynamicHostname,
  toOwnedDocuments,
} from './helpers.js';

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

describe('isAllowedDynamicHostname', () => {
  const project = 'project-sesame-426206';

  it('should allow localhost and *.localhost subdomains', () => {
    assert.strictEqual(isAllowedDynamicHostname('localhost', project), true);
    assert.strictEqual(isAllowedDynamicHostname('rp.localhost', project), true);
    assert.strictEqual(
      isAllowedDynamicHostname('idp.localhost', project),
      true
    );
  });

  it('should allow CloudTop and Google internal proxy domains', () => {
    assert.strictEqual(
      isAllowedDynamicHostname('agektmr2.c.googlers.com', project),
      true
    );
    assert.strictEqual(
      isAllowedDynamicHostname('8080-agektmr2.corp.google.com', project),
      true
    );
    assert.strictEqual(
      isAllowedDynamicHostname('preview.google.com', project),
      true
    );
  });

  it('should allow App Engine default, regional, and PR preview domains for the project', () => {
    assert.strictEqual(
      isAllowedDynamicHostname('project-sesame-426206.appspot.com', project),
      true
    );
    assert.strictEqual(
      isAllowedDynamicHostname(
        'pr-123-dot-project-sesame-426206.appspot.com',
        project
      ),
      true
    );
    assert.strictEqual(
      isAllowedDynamicHostname(
        'pr-123-dot-project-sesame-426206.uc.r.appspot.com',
        project
      ),
      true
    );
    assert.strictEqual(
      isAllowedDynamicHostname(
        'project-sesame-426206.uc.r.appspot.com',
        project
      ),
      true
    );
  });

  it('should reject untrusted domains, other App Engine projects, and IP addresses', () => {
    assert.strictEqual(
      isAllowedDynamicHostname('attacker.com', project),
      false
    );
    assert.strictEqual(
      isAllowedDynamicHostname('localhost.attacker.com', project),
      false
    );
    assert.strictEqual(
      isAllowedDynamicHostname('evil-project.appspot.com', project),
      false
    );
    assert.strictEqual(
      isAllowedDynamicHostname(
        'evil-project-sesame-426206.appspot.com',
        project
      ),
      false
    );
    assert.strictEqual(
      isAllowedDynamicHostname(
        '-invalid-dot-project-sesame-426206.appspot.com',
        project
      ),
      false
    );
    assert.strictEqual(isAllowedDynamicHostname('127.0.0.1', project), false);
  });
});

describe('getRequestContext', () => {
  const baseCfg = {
    is_prod: false,
    hostname: 'project-sesame-426206.appspot.com',
    origin: 'https://project-sesame-426206.appspot.com',
    associated_origins: [
      'https://project-sesame-426206.appspot.com',
      'android:apk-key-hash:test',
    ],
    project_name: 'project-sesame-426206',
  };

  it('should strictly return static config in production mode', () => {
    const prodCfg = {
      ...baseCfg,
      is_prod: true,
      hostname: 'identity.chrome.dev',
      origin: 'https://identity.chrome.dev',
      associated_origins: ['https://identity.chrome.dev'],
    };

    const ctx = getRequestContext(
      {
        headers: {host: 'pr-123-dot-project-sesame-426206.appspot.com'},
        hostname: 'pr-123-dot-project-sesame-426206.appspot.com',
        secure: true,
        protocol: 'https',
      },
      prodCfg
    );

    assert.strictEqual(ctx.rpId, 'identity.chrome.dev');
    assert.strictEqual(ctx.origin, 'https://identity.chrome.dev');
    assert.deepStrictEqual(ctx.associatedOrigins, [
      'https://identity.chrome.dev',
    ]);
  });

  it('should dynamically resolve App Engine PR preview hostname and origin in non-prod', () => {
    const ctx = getRequestContext(
      {
        headers: {
          host: 'pr-123-dot-project-sesame-426206.appspot.com',
          'x-forwarded-proto': 'https',
        },
        hostname: 'pr-123-dot-project-sesame-426206.appspot.com',
        secure: true,
        protocol: 'https',
      },
      baseCfg
    );

    assert.strictEqual(
      ctx.rpId,
      'pr-123-dot-project-sesame-426206.appspot.com'
    );
    assert.strictEqual(
      ctx.origin,
      'https://pr-123-dot-project-sesame-426206.appspot.com'
    );
    assert.ok(
      ctx.associatedOrigins.includes(
        'https://pr-123-dot-project-sesame-426206.appspot.com'
      )
    );
    assert.ok(ctx.associatedOrigins.includes('android:apk-key-hash:test'));
  });

  it('should dynamically resolve CloudTop proxy domain from x-forwarded-host with port', () => {
    const ctx = getRequestContext(
      {
        headers: {
          'x-forwarded-host': 'agektmr2.c.googlers.com:8443',
          host: 'localhost:8080',
        },
        hostname: 'localhost',
        secure: false,
        protocol: 'http',
      },
      baseCfg
    );

    assert.strictEqual(ctx.rpId, 'agektmr2.c.googlers.com');
    assert.strictEqual(ctx.origin, 'https://agektmr2.c.googlers.com:8443');
    assert.ok(
      ctx.associatedOrigins.includes('https://agektmr2.c.googlers.com:8443')
    );
    assert.ok(
      ctx.associatedOrigins.includes('https://agektmr2.c.googlers.com')
    );
  });

  it('should fall back to static config when Host header is untrusted or malformed', () => {
    const untrusted = getRequestContext(
      {
        headers: {host: 'evil.example.com'},
        hostname: 'evil.example.com',
        secure: true,
        protocol: 'https',
      },
      baseCfg
    );
    assert.strictEqual(untrusted.rpId, baseCfg.hostname);
    assert.strictEqual(untrusted.origin, baseCfg.origin);

    const malformed = getRequestContext(
      {
        headers: {host: 'localhost/path-injection'},
        hostname: 'localhost',
        secure: false,
        protocol: 'http',
      },
      baseCfg
    );
    assert.strictEqual(malformed.rpId, baseCfg.hostname);
  });
});
