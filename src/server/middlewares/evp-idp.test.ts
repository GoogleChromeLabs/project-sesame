/*
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

import {test, describe, beforeAll, afterAll, beforeEach} from 'vitest';
import assert from 'node:assert';
import express, {Request, Response, NextFunction} from 'express';
import {evpIdp} from './evp-idp.ts';
import http from 'http';
import crypto from 'node:crypto';

describe('EVP IDP Middlewares', () => {
  let app: express.Express;
  let server: http.Server;
  let port: number;
  let mockUser: any = null;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Inject mock session and locals
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.locals = {
        signin_status: mockUser ? 4 : 1, // SignedIn or SignedOut
        user: mockUser,
      };
      next();
    });

    app.use('/evp-idp', evpIdp);

    server = http.createServer(app);
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as import('net').AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    mockUser = null;
  });

  test('GET /evp-idp/jwks returns keys', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/evp-idp/jwks`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(Array.isArray(body.keys));
    assert.strictEqual(body.keys[0].kid, 'sesame-evp-key-2026');
  });

  test('POST /evp-idp/issuance returns 401 on unauthenticated user', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/evp-idp/issuance`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({request_token: 'demo@chrome.dev'}),
    });
    assert.strictEqual(res.status, 401);
  });

  test('POST /evp-idp/issuance succeeds for matching signed in user', async () => {
    mockUser = {
      username: 'demo@chrome.dev',
      id: 'user-1',
      displayName: 'Demo User',
    };

    // Browser key pair
    const browserKeyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });
    const browserJwk = browserKeyPair.publicKey.export({format: 'jwk'});

    // Construct a valid request token (JWT)
    const requestHeader = {alg: 'ES256', jwk: browserJwk, typ: 'evt-req+jwt'};
    const requestPayload = {email: 'demo@chrome.dev'};

    const headerB64 = Buffer.from(JSON.stringify(requestHeader)).toString(
      'base64url'
    );
    const payloadB64 = Buffer.from(JSON.stringify(requestPayload)).toString(
      'base64url'
    );
    const signingInput = `${headerB64}.${payloadB64}`;

    const signature = crypto.sign('SHA256', Buffer.from(signingInput, 'utf8'), {
      key: browserKeyPair.privateKey,
      dsaEncoding: 'ieee-p1363', // JWS format signature
    });
    const requestToken = `${signingInput}.${signature.toString('base64url')}`;

    const res = await fetch(`http://127.0.0.1:${port}/evp-idp/issuance`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({request_token: requestToken}),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(body.issuance_token);
    assert.ok(body.issuance_token.endsWith('~'));
  });

  test('POST /evp-idp/issuance fails on email mismatch', async () => {
    mockUser = {
      username: 'demo@chrome.dev',
      id: 'user-1',
    };

    const res = await fetch(`http://127.0.0.1:${port}/evp-idp/issuance`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({request_token: 'mismatch@chrome.dev'}),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error, 'invalid_request');
  });
});
