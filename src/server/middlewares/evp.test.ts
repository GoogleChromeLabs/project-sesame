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

import {test, describe, beforeAll, afterAll, beforeEach, vi} from 'vitest';
import assert from 'node:assert';
import express, {Request, Response, NextFunction} from 'express';
import {evp} from './evp.ts';
import http from 'http';
import dns from 'node:dns/promises';
import crypto from 'node:crypto';

// Mock DNS
vi.mock('node:dns/promises', () => ({
  default: {
    resolveTxt: vi.fn(),
  },
}));

describe('EVP Middlewares', () => {
  let app: express.Express;
  let server: http.Server;
  let port: number;
  let mockSession: any = {};
  const originalFetch = global.fetch;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Inject mock session and locals
    app.use((req: Request, res: Response, next: NextFunction) => {
      req.session = mockSession;
      res.locals = {signin_status: 1}; // UserSignInStatus.SignedOut
      next();
    });

    // Mock res.render directly
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.render = (view: string, options?: any, callback?: any): any => {
        if (callback) {
          callback(null, 'rendered-html');
        } else {
          res.send('rendered-html');
        }
      };
      next();
    });

    app.use('/evp', evp);

    server = http.createServer(app);
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as import('net').AddressInfo).port;
        resolve();
      });
    });

    global.fetch = vi.fn() as any;
  });

  afterAll(() => {
    server.close();
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    mockSession = {
      challenge: 'test-session-challenge',
    };
    vi.clearAllMocks();
  });

  test('GET /evp/ renders page and sets challenge', async () => {
    const res = await originalFetch(`http://127.0.0.1:${port}/evp/`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.strictEqual(text, 'rendered-html');
    assert.ok(mockSession.challenge);
    assert.notStrictEqual(mockSession.challenge, 'test-session-challenge');
  });

  test('POST /evp/verify returns 400 on missing parameters', async () => {
    const res = await originalFetch(`http://127.0.0.1:${port}/evp/verify`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'test@gmail.com'}),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error, 'Missing email or token (evt)');
  });

  test('POST /evp/verify fails on invalid token format (Step 1 fail)', async () => {
    const res = await originalFetch(`http://127.0.0.1:${port}/evp/verify`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        email: 'test@gmail.com',
        evt: 'invalid-token-no-tilde',
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.steps.step1.status, 'failed');
    assert.ok(body.error.includes('Invalid token format'));
  });

  test('POST /evp/verify performs full verification (Happy Path)', async () => {
    // Generate Ed25519 keys for IdP and Browser
    const idpKeyPair = crypto.generateKeyPairSync('ed25519');
    const browserKeyPair = crypto.generateKeyPairSync('ed25519');

    const idpJwk = idpKeyPair.publicKey.export({format: 'jwk'});
    const browserJwk = browserKeyPair.publicKey.export({format: 'jwk'});

    // Construct a valid SD-JWT (EVT)
    const evtHeader = {alg: 'EdDSA', kid: 'key-1', typ: 'evt+jwt'};
    const evtPayload = {
      iss: 'https://accounts.google.com',
      email: 'test@gmail.com',
      email_verified: true,
      cnf: {jwk: browserJwk},
    };

    const evtHeaderB64 = Buffer.from(JSON.stringify(evtHeader)).toString(
      'base64url'
    );
    const evtPayloadB64 = Buffer.from(JSON.stringify(evtPayload)).toString(
      'base64url'
    );
    const evtSigningInput = `${evtHeaderB64}.${evtPayloadB64}`;
    const evtSignature = crypto
      .sign(undefined, Buffer.from(evtSigningInput), idpKeyPair.privateKey)
      .toString('base64url');
    const sdJwt = `${evtSigningInput}.${evtSignature}`;

    // Construct a valid KB-JWT
    const kbHeader = {alg: 'EdDSA', typ: 'kb+jwt'};
    const calculatedEvtHash = crypto
      .createHash('sha256')
      .update(sdJwt + '~')
      .digest('base64url');

    const kbPayload = {
      aud: `http://127.0.0.1:${port}`,
      nonce: 'test-session-challenge', // matches mockSession.challenge
      sd_hash: calculatedEvtHash,
    };

    const kbHeaderB64 = Buffer.from(JSON.stringify(kbHeader)).toString(
      'base64url'
    );
    const kbPayloadB64 = Buffer.from(JSON.stringify(kbPayload)).toString(
      'base64url'
    );
    const kbSigningInput = `${kbHeaderB64}.${kbPayloadB64}`;
    const kbSignature = crypto
      .sign(undefined, Buffer.from(kbSigningInput), browserKeyPair.privateKey)
      .toString('base64url');
    const kbJwt = `${kbSigningInput}.${kbSignature}`;

    const fullToken = `${sdJwt}~${kbJwt}`;

    // Mock DNS resolveTxt
    vi.mocked(dns.resolveTxt).mockResolvedValue([['iss=accounts.google.com']]);

    // Mock fetch for well-known and JWKS
    vi.mocked(global.fetch).mockImplementation(async (url: any) => {
      if (
        url === 'https://accounts.google.com/.well-known/email-verification'
      ) {
        return {
          ok: true,
          json: async () => ({
            issuance_endpoint:
              'https://accounts.google.com/gsi/email-verification/issue',
            jwks_uri: 'https://accounts.google.com/oauth2/v3/certs',
            signing_alg_values_supported: ['EdDSA'],
          }),
        } as any;
      }
      if (url === 'https://accounts.google.com/oauth2/v3/certs') {
        return {
          ok: true,
          json: async () => ({
            keys: [{...idpJwk, kid: 'key-1'}],
          }),
        } as any;
      }
      return {ok: false} as any;
    });

    const res = await originalFetch(`http://127.0.0.1:${port}/evp/verify`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'test@gmail.com', evt: fullToken}),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;

    assert.strictEqual(
      body.success,
      true,
      `Verification failed with error: ${body.error}`
    );
    assert.strictEqual(body.verifiedEmail, 'test@gmail.com');
    assert.strictEqual(body.steps.step1.status, 'success');
    assert.strictEqual(body.steps.step2.status, 'success');
    assert.strictEqual(body.steps.step3.status, 'success');
    assert.strictEqual(body.steps.step4.status, 'success');
    assert.strictEqual(body.steps.step5.status, 'success');
    assert.strictEqual(body.steps.step6.status, 'success');
  });
});
