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

import {afterEach, beforeEach, describe, it} from 'vitest';
import assert from 'node:assert';
import express, {Request, Response, NextFunction} from 'express';
import http from 'node:http';
import jwt, {JwtPayload} from 'jsonwebtoken';
import {fedcm} from './fedcm.ts';
import {config} from '../config.ts';
import {RelyingParties, RelyingParty} from '../libs/relying-parties.ts';
import {UserSignInStatus} from '../libs/session.ts';

describe('FedCM Middleware JWT timestamps', () => {
  let server: http.Server;
  let port: number;
  let originalSupportedRps: RelyingParty[];
  let originalRps: RelyingParty[];

  const testRp: RelyingParty = {
    origin: 'https://rp.example.com',
    client_id: 'https://rp.example.com',
    name: 'Test RP',
    secret: 'test-rp-secret',
  };

  const mockUser = {
    id: 'user-123',
    username: 'demo@example.com',
    displayName: 'Demo User',
    picture: 'https://example.com/avatar.png',
    approved_clients: ['https://rp.example.com'],
  };

  beforeEach(async () => {
    originalSupportedRps = [...config.supported_rps];
    originalRps = [...RelyingParties.rps];
    config.supported_rps = [testRp];
    RelyingParties.rps = [testRp];

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));

    app.use((req: Request, res: Response, next: NextFunction) => {
      res.locals = {
        signin_status: UserSignInStatus.SignedIn,
        user: structuredClone(mockUser),
      };
      next();
    });

    app.use('/fedcm', fedcm);

    server = http.createServer(app);
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as import('net').AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    config.supported_rps = originalSupportedRps;
    RelyingParties.rps = originalRps;
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  });

  it('POST /fedcm/idtokens sets iat and exp in Unix epoch seconds', async () => {
    const beforeSec = Math.floor(Date.now() / 1000);
    const res = await fetch(`http://127.0.0.1:${port}/fedcm/idtokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'webidentity',
        Origin: testRp.origin,
      },
      body: JSON.stringify({
        client_id: testRp.client_id,
        account_id: mockUser.id,
        consent_acquired: 'false',
        disclosure_text_shown: 'false',
        params: JSON.stringify({nonce: 'test-nonce-123'}),
      }),
    });
    const afterSec = Math.floor(Date.now() / 1000);

    assert.strictEqual(res.status, 200);
    const {token} = (await res.json()) as {token: string};
    const payload = jwt.verify(token, testRp.secret) as JwtPayload;

    assert.ok(typeof payload.iat === 'number');
    assert.ok(typeof payload.exp === 'number');
    assert.ok(
      payload.iat >= beforeSec && payload.iat <= afterSec,
      `Expected iat (${payload.iat}) to be in seconds between ${beforeSec} and ${afterSec}`
    );
    const expectedLifetimeSec = Math.floor(config.id_token_lifetime / 1000);
    assert.ok(
      Math.abs(payload.exp - payload.iat - expectedLifetimeSec) <= 1,
      `Expected exp - iat (${payload.exp - payload.iat}) to match ${expectedLifetimeSec}s`
    );
  });

  it('POST /fedcm/idtokens falls back to top-level req.body.nonce when params is omitted', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/fedcm/idtokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'webidentity',
        Origin: testRp.origin,
      },
      body: JSON.stringify({
        client_id: testRp.client_id,
        account_id: mockUser.id,
        consent_acquired: 'false',
        disclosure_text_shown: 'false',
        nonce: 'fallback-nonce-789',
      }),
    });

    assert.strictEqual(res.status, 200);
    const {token} = (await res.json()) as {token: string};
    const payload = jwt.verify(token, testRp.secret) as JwtPayload;
    assert.strictEqual(payload.nonce, 'fallback-nonce-789');
  });

  it('POST /fedcm/idtokens returns 400 when params is invalid JSON even if fallback nonce is provided', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/fedcm/idtokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'webidentity',
        Origin: testRp.origin,
      },
      body: JSON.stringify({
        client_id: testRp.client_id,
        account_id: mockUser.id,
        consent_acquired: 'false',
        disclosure_text_shown: 'false',
        params: '{not-valid-json',
        nonce: 'fallback-nonce-789',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as {error: string};
    assert.strictEqual(body.error, 'Invalid params');
  });

  it('POST /fedcm/createToken sets iat and exp in Unix epoch seconds', async () => {
    const beforeSec = Math.floor(Date.now() / 1000);
    const res = await fetch(`http://127.0.0.1:${port}/fedcm/createToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        nonce: 'test-nonce-456',
        rp_origin: testRp.origin,
      }),
    });
    const afterSec = Math.floor(Date.now() / 1000);

    assert.strictEqual(res.status, 200);
    const {token} = (await res.json()) as {token: string};
    const payload = jwt.verify(token, testRp.secret) as JwtPayload;

    assert.ok(typeof payload.iat === 'number');
    assert.ok(typeof payload.exp === 'number');
    assert.ok(
      payload.iat >= beforeSec && payload.iat <= afterSec,
      `Expected iat (${payload.iat}) to be in seconds between ${beforeSec} and ${afterSec}`
    );
    const expectedLifetimeSec = Math.floor(config.id_token_lifetime / 1000);
    assert.ok(
      Math.abs(payload.exp - payload.iat - expectedLifetimeSec) <= 1,
      `Expected exp - iat (${payload.exp - payload.iat}) to match ${expectedLifetimeSec}s`
    );
  });

  it('POST /fedcm/createToken enforces csrfCheck, rejects cross-origin callers without CORS headers, and validates nonce', async () => {
    // Missing X-Requested-With -> 400
    const noCsrf = await fetch(`http://127.0.0.1:${port}/fedcm/createToken`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({nonce: 'n1', rp_origin: testRp.origin}),
    });
    assert.strictEqual(noCsrf.status, 400);
    assert.strictEqual(noCsrf.headers.get('access-control-allow-origin'), null);

    // Same-origin Origin header -> 200
    const sameOrigin = await fetch(
      `http://127.0.0.1:${port}/fedcm/createToken`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Forwarded-Host': 'idp.localhost',
          'X-Forwarded-Proto': 'https',
          Origin: 'https://idp.localhost',
        },
        body: JSON.stringify({nonce: 'n1', rp_origin: testRp.origin}),
      }
    );
    assert.strictEqual(sameOrigin.status, 200);
    assert.strictEqual(
      sameOrigin.headers.get('access-control-allow-origin'),
      null
    );

    // Cross-origin Origin header -> 403 and no Access-Control-Allow-Origin
    const crossOrigin = await fetch(
      `http://127.0.0.1:${port}/fedcm/createToken`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          Origin: 'https://evil.example',
        },
        body: JSON.stringify({nonce: 'n1', rp_origin: testRp.origin}),
      }
    );
    assert.strictEqual(crossOrigin.status, 403);
    assert.strictEqual(
      crossOrigin.headers.get('access-control-allow-origin'),
      null
    );

    // Non-string or whitespace-only nonce -> 400
    for (const badNonce of ['', '   ', 12345, null]) {
      const badNonceRes = await fetch(
        `http://127.0.0.1:${port}/fedcm/createToken`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({nonce: badNonce, rp_origin: testRp.origin}),
        }
      );
      assert.strictEqual(badNonceRes.status, 400);
    }
  });

  it('POST /fedcm/disconnect validates client_id, Origin, and account_hint and persists approved_clients update without erasing password', async () => {
    const {Users} = await import('../libs/users.ts');
    const updatedSnapshots: any[] = [];
    const origFindById = Users.findById;
    const origUpdate = Users.update;
    Users.findById = async (id: string) =>
      id === mockUser.id
        ? ({...mockUser, password: 'StoredPassword123!'} as any)
        : undefined;
    Users.update = async (user: any) => {
      updatedSnapshots.push(structuredClone(user));
      return user;
    };

    try {
      // Unregistered client_id -> 400
      const unregistered = await fetch(
        `http://127.0.0.1:${port}/fedcm/disconnect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Sec-Fetch-Dest': 'webidentity',
            Origin: 'https://unregistered.example.com',
          },
          body: JSON.stringify({
            client_id: 'https://unregistered.example.com',
            account_hint: mockUser.id,
          }),
        }
      );
      assert.strictEqual(unregistered.status, 400);

      // Registered client_id with mismatched Origin -> 400
      const wrongOrigin = await fetch(
        `http://127.0.0.1:${port}/fedcm/disconnect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Sec-Fetch-Dest': 'webidentity',
            Origin: 'https://evil.example',
          },
          body: JSON.stringify({
            client_id: testRp.client_id,
            account_hint: mockUser.id,
          }),
        }
      );
      assert.strictEqual(wrongOrigin.status, 400);

      // Mismatched account_hint -> 401
      const wrongHint = await fetch(
        `http://127.0.0.1:${port}/fedcm/disconnect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Sec-Fetch-Dest': 'webidentity',
            Origin: testRp.origin,
          },
          body: JSON.stringify({
            client_id: testRp.client_id,
            account_hint: 'other-user-id',
          }),
        }
      );
      assert.strictEqual(wrongHint.status, 401);
      assert.strictEqual(updatedSnapshots.length, 0);

      // Valid disconnect -> 200 and awaits Users.update
      const ok = await fetch(`http://127.0.0.1:${port}/fedcm/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Sec-Fetch-Dest': 'webidentity',
          Origin: testRp.origin,
        },
        body: JSON.stringify({
          client_id: testRp.client_id,
          account_hint: mockUser.id,
        }),
      });
      assert.strictEqual(ok.status, 200);
      assert.deepStrictEqual(await ok.json(), {account_id: mockUser.id});
      assert.strictEqual(updatedSnapshots.length, 1);
      assert.deepStrictEqual(updatedSnapshots[0].approved_clients, []);
      assert.strictEqual(updatedSnapshots[0].password, 'StoredPassword123!');
    } finally {
      Users.findById = origFindById;
      Users.update = origUpdate;
    }
  });
});
