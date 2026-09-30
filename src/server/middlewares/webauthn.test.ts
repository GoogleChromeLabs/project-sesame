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

import {test, describe, beforeAll, afterAll, beforeEach} from 'vitest';
import assert from 'node:assert';
import crypto from 'node:crypto';
import express, {Request, Response, NextFunction} from 'express';
import type {AuthenticationResponseJSON} from '@simplewebauthn/server';
import {webauthn} from './webauthn.ts';
import {config} from '~project-sesame/server/config.ts';
import {PublicKeyCredentials} from '~project-sesame/server/libs/public-key-credentials.ts';
import {Users} from '~project-sesame/server/libs/users.ts';
import http from 'http';

/**
 * A minimal software passkey (ES256 / P-256) that produces authentication
 * responses with real signatures, so `/webauthn/signinResponse` is exercised
 * end-to-end through `verifyAuthenticationResponse()`.
 */
class SoftwarePasskey {
  readonly id = crypto.randomBytes(16).toString('base64url');
  private readonly keys = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });

  /**
   * The public key as a CBOR-encoded COSE_Key, as stored in Firestore:
   * map(5) {1 (kty): 2 (EC2), 3 (alg): -7 (ES256), -1 (crv): 1 (P-256),
   * -2 (x): bstr(32), -3 (y): bstr(32)}.
   */
  get cosePublicKey(): string {
    const {x = '', y = ''} = this.keys.publicKey.export({format: 'jwk'});
    return Buffer.concat([
      Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
      Buffer.from(x, 'base64url'),
      Buffer.from([0x22, 0x58, 0x20]),
      Buffer.from(y, 'base64url'),
    ]).toString('base64url');
  }

  /**
   * Creates a signed assertion for the given client data.
   * @param clientData - The `CollectedClientData` to embed and sign over.
   * @returns The assertion in the JSON form posted by the client.
   */
  sign(clientData: Record<string, unknown>): AuthenticationResponseJSON {
    const clientDataJSON = Buffer.from(JSON.stringify(clientData));
    const authenticatorData = Buffer.concat([
      crypto.createHash('sha256').update(config.hostname).digest(), // rpIdHash
      Buffer.from([0x05]), // flags: UP | UV
      Buffer.alloc(4), // signCount: 0
    ]);
    const clientDataHash = crypto
      .createHash('sha256')
      .update(clientDataJSON)
      .digest();
    const signature = crypto.sign(
      'sha256',
      Buffer.concat([authenticatorData, clientDataHash]),
      this.keys.privateKey
    );
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientDataJSON.toString('base64url'),
        authenticatorData: authenticatorData.toString('base64url'),
        signature: signature.toString('base64url'),
      },
    };
  }
}

describe('WebAuthn Middlewares', () => {
  let app: express.Express;
  let server: http.Server;
  let port: number;
  let mockSession: any = {};

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Inject mock session and locals
    app.use((req: Request, res: Response, next: NextFunction) => {
      req.session = mockSession;
      res.locals = {signin_status: 1}; // UserSignInStatus.SignedOut
      next();
    });

    app.use('/webauthn', webauthn);

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
    mockSession = {};
  });

  test('signinRequest preserves existing challenge', async () => {
    mockSession.challenge = 'existing-challenge-123';

    const res = await fetch(`http://127.0.0.1:${port}/webauthn/signinRequest`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      // Ignore parse failure
    }

    assert.strictEqual(
      res.status,
      200,
      `Expected 200 OK, got ${res.status}: ${text}`
    );
    assert.ok(body, 'Response body should be JSON');
    assert.strictEqual(
      body.challenge,
      'existing-challenge-123',
      'The challenge in the WebAuthn options should be the existing challenge'
    );
    assert.strictEqual(
      mockSession.challenge,
      'existing-challenge-123',
      'The challenge in the session should remain unchanged'
    );
  });

  test('signinRequest generates new challenge if none exists', async () => {
    assert.strictEqual(mockSession.challenge, undefined);

    const res = await fetch(`http://127.0.0.1:${port}/webauthn/signinRequest`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      // Ignore parse failure
    }

    assert.strictEqual(
      res.status,
      200,
      `Expected 200 OK, got ${res.status}: ${text}`
    );
    assert.ok(body, 'Response body should be JSON');
    assert.ok(
      body.challenge,
      'The WebAuthn options should include a challenge'
    );
    assert.notStrictEqual(body.challenge, 'existing-challenge-123');
    // Ensure the new challenge was saved to the session
    assert.strictEqual(
      mockSession.challenge,
      body.challenge,
      'The generated challenge should be saved in the session'
    );
  });

  /**
   * `/webauthn/signinResponse` passes `config.csp.frame_ancestors` as
   * `expectedTopOrigin`, which SimpleWebAuthn v14 enforces for cross-origin
   * (iframe) assertions such as the IdP iframe used by `/passkey-iframe`.
   */
  describe('signinResponse cross-origin (topOrigin) verification', () => {
    const passkey = new SoftwarePasskey();
    const embedder = 'https://rp.example';
    const originalFrameAncestors = config.csp.frame_ancestors;
    let username: string;
    let userId: string;

    beforeAll(async () => {
      username = `testuser-signin-${Date.now()}`;
      // Use an explicit passkey user ID because `User.passkeyUserId` is
      // optional in the type while the credential requires one.
      const passkeyUserId = crypto.randomBytes(16).toString('base64url');
      const user = await Users.create(username, {passkeyUserId});
      userId = user.id;
      await PublicKeyCredentials.update({
        id: passkey.id,
        passkeyUserId,
        credentialPublicKey: passkey.cosePublicKey,
        credentialType: 'public-key',
        aaguid: '00000000-0000-0000-0000-000000000000',
        userVerified: true,
        transports: ['internal'],
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: true,
        registeredAt: Date.now(),
      });
    });

    afterAll(async () => {
      config.csp.frame_ancestors = originalFrameAncestors;
      await PublicKeyCredentials.remove(passkey.id);
      await Users.delete(userId);
    });

    beforeEach(() => {
      config.csp.frame_ancestors = [embedder];
      mockSession.challenge = crypto.randomBytes(32).toString('base64url');
    });

    /**
     * Posts an assertion signed over the given client data overrides.
     * @param clientData - Fields merged into a valid `webauthn.get` client data.
     * @returns The HTTP status and parsed JSON body.
     */
    async function signIn(
      clientData: Record<string, unknown>
    ): Promise<{status: number; body: any}> {
      const assertion = passkey.sign({
        type: 'webauthn.get',
        challenge: mockSession.challenge,
        origin: config.origin,
        ...clientData,
      });
      const res = await fetch(
        `http://127.0.0.1:${port}/webauthn/signinResponse`,
        {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(assertion),
        }
      );
      return {status: res.status, body: await res.json()};
    }

    test('accepts a same-origin assertion', async () => {
      const {status, body} = await signIn({crossOrigin: false});
      assert.strictEqual(status, 200, JSON.stringify(body));
      assert.strictEqual(body.username, username);
      assert.strictEqual(mockSession.user?.username, username);
    });

    test('accepts a cross-origin assertion from an allowed embedder', async () => {
      const {status, body} = await signIn({
        crossOrigin: true,
        topOrigin: embedder,
      });
      assert.strictEqual(status, 200, JSON.stringify(body));
      assert.strictEqual(body.username, username);
    });

    test('rejects a cross-origin assertion from an unexpected embedder', async () => {
      const {status, body} = await signIn({
        crossOrigin: true,
        topOrigin: 'https://evil.example',
      });
      assert.notStrictEqual(status, 200);
      assert.match(body.error, /top origin of "https:\/\/evil\.example"/);
      assert.strictEqual(mockSession.user, undefined, 'Must not sign in');
      assert.strictEqual(mockSession.challenge, undefined, 'Must consume');
    });

    test('rejects cross-origin assertions when no embedder is configured', async () => {
      config.csp.frame_ancestors = [];
      const {status, body} = await signIn({
        crossOrigin: true,
        topOrigin: embedder,
      });
      assert.notStrictEqual(status, 200);
      assert.match(body.error, /expectedTopOrigin/);
      assert.strictEqual(mockSession.user, undefined, 'Must not sign in');
    });

    test('accepts a cross-origin assertion without topOrigin (e.g. Safari)', async () => {
      const {status, body} = await signIn({crossOrigin: true});
      assert.strictEqual(status, 200, JSON.stringify(body));
    });

    test('rejects topOrigin on a same-origin assertion', async () => {
      const {status, body} = await signIn({
        crossOrigin: false,
        topOrigin: embedder,
      });
      assert.notStrictEqual(status, 200);
      assert.match(body.error, /non-cross-origin/);
    });
  });
});
