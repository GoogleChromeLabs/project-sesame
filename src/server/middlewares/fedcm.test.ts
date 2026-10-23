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

  it('POST /fedcm/createToken sets iat and exp in Unix epoch seconds', async () => {
    const beforeSec = Math.floor(Date.now() / 1000);
    const res = await fetch(`http://127.0.0.1:${port}/fedcm/createToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
});
