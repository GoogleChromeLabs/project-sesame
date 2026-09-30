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
import {Users} from '../libs/users.ts';
import http from 'http';
import dns from 'node:dns/promises';
import crypto from 'node:crypto';

// Mock DNS
vi.mock('node:dns/promises', () => ({
  default: {
    resolveTxt: vi.fn(),
  },
}));

// The EVP router enforces `csrfCheck`, which requires this header on every
// API request (the client-side `post()` helper always sends it).
const JSON_XHR_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

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
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockSession = {
      challenge: 'test-session-challenge',
    };
    vi.clearAllMocks();
    // By default, no account exists for the email being signed up.
    vi.spyOn(Users, 'findByUsername').mockResolvedValue(undefined);
  });

  test('POST /evp/verify returns 400 on missing parameters', async () => {
    const res = await originalFetch(`http://127.0.0.1:${port}/evp/verify`, {
      method: 'POST',
      headers: JSON_XHR_HEADERS,
      body: JSON.stringify({email: 'test@gmail.com'}),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error, 'Missing email or token (evt)');
  });

  test('POST /evp/verify fails on invalid token format (Step 1 fail)', async () => {
    const res = await originalFetch(`http://127.0.0.1:${port}/evp/verify`, {
      method: 'POST',
      headers: JSON_XHR_HEADERS,
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

  test('POST /evp/verify performs full verification with disclosures (Happy Path)', async () => {
    const idpKeyPair = crypto.generateKeyPairSync('ed25519');
    const browserKeyPair = crypto.generateKeyPairSync('ed25519');

    const idpJwk = idpKeyPair.publicKey.export({format: 'jwk'});
    const browserJwk = browserKeyPair.publicKey.export({format: 'jwk'});

    const now = Math.floor(Date.now() / 1000);

    // Construct a valid SD-JWT (EVT) with selective disclosures
    const evtHeader = {alg: 'EdDSA', kid: 'key-1', typ: 'evt+jwt'};
    const evtPayload = {
      iss: 'https://accounts.google.com',
      email: 'test@gmail.com',
      email_verified: true,
      iat: now - 30, // 30s ago
      exp: now + 300, // in 5 mins
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

    // Test multi-part format with disclosure included in sd_hash
    const mockDisclosure = Buffer.from(
      JSON.stringify(['salt', 'field', 'value'])
    ).toString('base64url');

    // Construct a valid KB-JWT
    const kbHeader = {alg: 'EdDSA', typ: 'kb+jwt'};
    const calculatedEvtHash = crypto
      .createHash('sha256')
      .update(`${sdJwt}~${mockDisclosure}~`)
      .digest('base64url');

    const kbPayload = {
      aud: `http://127.0.0.1:${port}`,
      nonce: 'test-session-challenge', // matches mockSession.challenge
      sd_hash: calculatedEvtHash,
      iat: now - 10,
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

    const fullToken = `${sdJwt}~${mockDisclosure}~${kbJwt}`;

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
      headers: JSON_XHR_HEADERS,
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
    assert.deepStrictEqual(body.steps.step1.outputs.disclosures, [
      mockDisclosure,
    ]);
    assert.strictEqual(body.steps.step2.status, 'success');
    assert.strictEqual(body.steps.step3.status, 'success');
    assert.strictEqual(body.steps.step4.status, 'success');
    assert.strictEqual(body.steps.step5.status, 'success');
    assert.strictEqual(body.steps.step6.status, 'success');
    assert.strictEqual(mockSession.challenge, undefined);
    assert.strictEqual(mockSession.user, undefined);
    // The verified email starts a passwordless sign-up.
    assert.strictEqual(mockSession.signup_user.username, 'test@gmail.com');
    assert.strictEqual(mockSession.signup_user.email, 'test@gmail.com');
    assert.ok(mockSession.signup_user.passkeyUserId);
  });

  test('POST /evp/verify fails when sd_hash omits disclosures', async () => {
    const idpKeyPair = crypto.generateKeyPairSync('ed25519');
    const browserKeyPair = crypto.generateKeyPairSync('ed25519');
    const browserJwk = browserKeyPair.publicKey.export({format: 'jwk'});

    const now = Math.floor(Date.now() / 1000);

    const evtHeader = {alg: 'EdDSA', kid: 'key-1', typ: 'evt+jwt'};
    const evtPayload = {
      iss: 'https://accounts.google.com',
      email: 'test@gmail.com',
      email_verified: true,
      iat: now - 30,
      exp: now + 300,
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

    // Incorrectly compute sd_hash without the disclosure
    const wrongHash = crypto
      .createHash('sha256')
      .update(sdJwt + '~')
      .digest('base64url');

    const kbHeader = {alg: 'EdDSA', typ: 'kb+jwt'};
    const kbPayload = {
      aud: `http://127.0.0.1:${port}`,
      nonce: 'test-session-challenge',
      sd_hash: wrongHash,
      iat: now - 10,
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

    const mockDisclosure = Buffer.from(
      JSON.stringify(['salt', 'field', 'value'])
    ).toString('base64url');
    const fullToken = `${sdJwt}~${mockDisclosure}~${kbJwt}`;

    const res = await originalFetch(`http://127.0.0.1:${port}/evp/verify`, {
      method: 'POST',
      headers: JSON_XHR_HEADERS,
      body: JSON.stringify({email: 'test@gmail.com', evt: fullToken}),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.steps.step2.status, 'failed');
    assert.ok(body.error.includes('Hash binding'));
  });

  test('POST /evp/verify fails when token is expired (exp check)', async () => {
    const idpKeyPair = crypto.generateKeyPairSync('ed25519');
    const browserKeyPair = crypto.generateKeyPairSync('ed25519');
    const browserJwk = browserKeyPair.publicKey.export({format: 'jwk'});

    const now = Math.floor(Date.now() / 1000);

    const evtHeader = {alg: 'EdDSA', kid: 'key-1', typ: 'evt+jwt'};
    const evtPayload = {
      iss: 'https://accounts.google.com',
      email: 'test@gmail.com',
      email_verified: true,
      iat: now - 500,
      exp: now - 100, // Expired
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

    const calculatedEvtHash = crypto
      .createHash('sha256')
      .update(sdJwt + '~')
      .digest('base64url');

    const kbHeader = {alg: 'EdDSA', typ: 'kb+jwt'};
    const kbPayload = {
      aud: `http://127.0.0.1:${port}`,
      nonce: 'test-session-challenge',
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

    const res = await originalFetch(`http://127.0.0.1:${port}/evp/verify`, {
      method: 'POST',
      headers: JSON_XHR_HEADERS,
      body: JSON.stringify({email: 'test@gmail.com', evt: fullToken}),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.steps.step2.status, 'failed');
    assert.ok(body.error.includes('expired'));
  });

  test('POST /evp/verify fails when iat is older than 5 minutes', async () => {
    const idpKeyPair = crypto.generateKeyPairSync('ed25519');
    const browserKeyPair = crypto.generateKeyPairSync('ed25519');
    const browserJwk = browserKeyPair.publicKey.export({format: 'jwk'});

    const now = Math.floor(Date.now() / 1000);

    const evtHeader = {alg: 'EdDSA', kid: 'key-1', typ: 'evt+jwt'};
    const evtPayload = {
      iss: 'https://accounts.google.com',
      email: 'test@gmail.com',
      email_verified: true,
      iat: now - 350, // 350s ago > 300s
      exp: now + 500,
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

    const calculatedEvtHash = crypto
      .createHash('sha256')
      .update(sdJwt + '~')
      .digest('base64url');

    const kbHeader = {alg: 'EdDSA', typ: 'kb+jwt'};
    const kbPayload = {
      aud: `http://127.0.0.1:${port}`,
      nonce: 'test-session-challenge',
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

    const res = await originalFetch(`http://127.0.0.1:${port}/evp/verify`, {
      method: 'POST',
      headers: JSON_XHR_HEADERS,
      body: JSON.stringify({email: 'test@gmail.com', evt: fullToken}),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.steps.step2.status, 'failed');
    assert.ok(body.error.includes('too old'));
  });

  /**
   * Builds a fully valid EVT + KB-JWT for `test@gmail.com` bound to `nonce`,
   * and mocks DNS and the issuer's endpoints so every verification step
   * passes unless the test changes something.
   *
   * @param nonce - The nonce to embed in the KB-JWT.
   * @returns The `~`-joined token as submitted by the browser.
   */
  function prepareValidToken(nonce: string): string {
    const idpKeyPair = crypto.generateKeyPairSync('ed25519');
    const browserKeyPair = crypto.generateKeyPairSync('ed25519');
    const idpJwk = idpKeyPair.publicKey.export({format: 'jwk'});
    const browserJwk = browserKeyPair.publicKey.export({format: 'jwk'});
    const now = Math.floor(Date.now() / 1000);

    const encode = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');

    const evtSigningInput = `${encode({alg: 'EdDSA', kid: 'key-1', typ: 'evt+jwt'})}.${encode(
      {
        iss: 'https://accounts.google.com',
        email: 'test@gmail.com',
        email_verified: true,
        iat: now - 30,
        exp: now + 300,
        cnf: {jwk: browserJwk},
      }
    )}`;
    const sdJwt = `${evtSigningInput}.${crypto
      .sign(undefined, Buffer.from(evtSigningInput), idpKeyPair.privateKey)
      .toString('base64url')}`;

    const kbSigningInput = `${encode({alg: 'EdDSA', typ: 'kb+jwt'})}.${encode({
      aud: `http://127.0.0.1:${port}`,
      nonce,
      sd_hash: crypto
        .createHash('sha256')
        .update(`${sdJwt}~`)
        .digest('base64url'),
      iat: now - 10,
    })}`;
    const kbJwt = `${kbSigningInput}.${crypto
      .sign(undefined, Buffer.from(kbSigningInput), browserKeyPair.privateKey)
      .toString('base64url')}`;

    vi.mocked(dns.resolveTxt).mockResolvedValue([['iss=accounts.google.com']]);
    vi.mocked(global.fetch).mockImplementation(async (url: any) => {
      if (
        url === 'https://accounts.google.com/.well-known/email-verification'
      ) {
        return {
          ok: true,
          json: async () => ({
            jwks_uri: 'https://accounts.google.com/oauth2/v3/certs',
          }),
        } as any;
      }
      if (url === 'https://accounts.google.com/oauth2/v3/certs') {
        return {
          ok: true,
          json: async () => ({keys: [{...idpJwk, kid: 'key-1'}]}),
        } as any;
      }
      return {ok: false} as any;
    });

    return `${sdJwt}~${kbJwt}`;
  }

  /**
   * Sends a JSON POST request to the test server.
   *
   * @param path - The request path.
   * @param payload - The JSON body.
   * @param headers - Request headers. Defaults to JSON + XHR headers.
   * @returns The fetch response.
   */
  function postJson(
    path: string,
    payload: object,
    headers: Record<string, string> = JSON_XHR_HEADERS
  ): Promise<globalThis.Response> {
    return originalFetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }

  test('POST /evp/verify fails closed when the session has no nonce', async () => {
    const evt = prepareValidToken('test-session-challenge');
    delete mockSession.challenge;

    const res = await postJson('/evp/verify', {email: 'test@gmail.com', evt});

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.steps.step2.status, 'failed');
    assert.ok(body.error.includes('No verification challenge'));
    assert.strictEqual(mockSession.signup_user, undefined);
  });

  test('POST /evp/verify rejects an email that already has an account', async () => {
    const evt = prepareValidToken('test-session-challenge');
    vi.mocked(Users.findByUsername).mockResolvedValue({
      id: 'existing',
      username: 'test@gmail.com',
    } as any);

    const res = await postJson('/evp/verify', {email: 'test@gmail.com', evt});

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('already exists'));
    assert.strictEqual(body.verifiedEmail, '');
    assert.strictEqual(mockSession.signup_user, undefined);
  });

  test('POST /evp/verify rejects requests without the XHR header', async () => {
    const res = await postJson(
      '/evp/verify',
      {email: 'test@gmail.com', evt: 'a~b'},
      {'Content-Type': 'application/json'}
    );
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error, 'Invalid XHR request.');
  });

  test('POST /evp/otp accepts a 6-digit code and starts sign-up', async () => {
    const res = await postJson('/evp/otp', {
      email: 'Someone@Example.com',
      otp: '123456',
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.verifiedEmail, 'someone@example.com');
    assert.strictEqual(mockSession.signup_user.username, 'someone@example.com');
    assert.ok(mockSession.signup_user.passkeyUserId);
    assert.strictEqual(mockSession.challenge, undefined);
  });

  test('POST /evp/otp rejects a malformed code', async () => {
    const res = await postJson('/evp/otp', {
      email: 'someone@example.com',
      otp: '12ab',
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(mockSession.signup_user, undefined);
  });

  test('POST /evp/otp requires the page challenge', async () => {
    delete mockSession.challenge;

    const res = await postJson('/evp/otp', {
      email: 'someone@example.com',
      otp: '123456',
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.ok(body.error.includes('Reload the page'));
    assert.strictEqual(mockSession.signup_user, undefined);
  });

  test('POST /evp/otp rejects an invalid email address', async () => {
    const res = await postJson('/evp/otp', {
      email: 'not-an-email',
      otp: '123456',
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(mockSession.signup_user, undefined);
  });
});
