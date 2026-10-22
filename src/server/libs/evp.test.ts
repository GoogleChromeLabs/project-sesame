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

import {describe, test, beforeEach, vi} from 'vitest';
import assert from 'node:assert';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import {decodeJwt, verifyEvpToken} from './evp.ts';

vi.mock('node:dns/promises', () => ({
  default: {
    resolveTxt: vi.fn(),
  },
}));

describe('EVP Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn() as any;
  });

  describe('decodeJwt', () => {
    test('successfully decodes valid JWT parts', () => {
      const header = {alg: 'EdDSA', typ: 'JWT'};
      const payload = {sub: '12345'};
      const headerB64 = Buffer.from(JSON.stringify(header)).toString(
        'base64url'
      );
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64url'
      );
      const jwt = `${headerB64}.${payloadB64}.signature`;

      const result = decodeJwt(jwt);
      assert.deepStrictEqual(result.header, header);
      assert.deepStrictEqual(result.payload, payload);
      assert.strictEqual(result.parts.length, 3);
    });

    test('throws error for invalid JWT format without parts', () => {
      assert.throws(() => decodeJwt('invalid-jwt'), /Invalid JWT format/);
    });
  });

  describe('verifyEvpToken', () => {
    test('fails on invalid token format (Step 1 fail)', async () => {
      const result = await verifyEvpToken({
        email: 'test@gmail.com',
        evt: 'invalid-token-no-tilde',
        expectedAudience: 'http://127.0.0.1:8080',
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.steps.step1.status, 'failed');
      assert.ok(result.error?.includes('Invalid token format'));
    });

    test('performs full verification with disclosures (Happy Path)', async () => {
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
        aud: 'http://127.0.0.1:8080',
        nonce: 'test-session-challenge',
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
      vi.mocked(dns.resolveTxt).mockResolvedValue([
        ['iss=accounts.google.com'],
      ]);

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

      const result = await verifyEvpToken({
        email: 'test@gmail.com',
        evt: fullToken,
        expectedAudience: 'http://127.0.0.1:8080',
        expectedNonce: 'test-session-challenge',
      });

      assert.strictEqual(
        result.success,
        true,
        `Verification failed with error: ${result.error}`
      );
      assert.strictEqual(result.verifiedEmail, 'test@gmail.com');
      assert.strictEqual(result.steps.step1.status, 'success');
      assert.deepStrictEqual(result.steps.step1.outputs.disclosures, [
        mockDisclosure,
      ]);
      assert.strictEqual(result.steps.step2.status, 'success');
      assert.strictEqual(result.steps.step3.status, 'success');
      assert.strictEqual(result.steps.step4.status, 'success');
      assert.strictEqual(result.steps.step5.status, 'success');
      assert.strictEqual(result.steps.step6.status, 'success');
    });

    test('fails when sd_hash omits disclosures', async () => {
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

      const wrongHash = crypto
        .createHash('sha256')
        .update(sdJwt + '~')
        .digest('base64url');

      const kbHeader = {alg: 'EdDSA', typ: 'kb+jwt'};
      const kbPayload = {
        aud: 'http://127.0.0.1:8080',
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

      const result = await verifyEvpToken({
        email: 'test@gmail.com',
        evt: fullToken,
        expectedAudience: 'http://127.0.0.1:8080',
        expectedNonce: 'test-session-challenge',
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.steps.step2.status, 'failed');
      assert.ok(result.error?.includes('Hash binding'));
    });

    test('fails when token is expired (exp check)', async () => {
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
        aud: 'http://127.0.0.1:8080',
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

      const result = await verifyEvpToken({
        email: 'test@gmail.com',
        evt: fullToken,
        expectedAudience: 'http://127.0.0.1:8080',
        expectedNonce: 'test-session-challenge',
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.steps.step2.status, 'failed');
      assert.ok(result.error?.includes('expired'));
    });

    test('fails when iat is older than 5 minutes', async () => {
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
        aud: 'http://127.0.0.1:8080',
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

      const result = await verifyEvpToken({
        email: 'test@gmail.com',
        evt: fullToken,
        expectedAudience: 'http://127.0.0.1:8080',
        expectedNonce: 'test-session-challenge',
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.steps.step2.status, 'failed');
      assert.ok(result.error?.includes('too old'));
    });
  });
});
