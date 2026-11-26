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
import crypto from 'node:crypto';
import express, {Request, Response, NextFunction} from 'express';
import {
  SettingsService,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {webauthn} from './webauthn.ts';
import {config} from '~project-sesame/server/config.ts';
import {PublicKeyCredentials} from '~project-sesame/server/libs/public-key-credentials.ts';
import {UserSignInStatus} from '~project-sesame/server/libs/session.ts';
import {User, Users} from '~project-sesame/server/libs/users.ts';
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

  /**
   * Builds a `RegistrationResponseJSON` with a `"none"` attestation object so
   * `/webauthn/registerResponse` is exercised end-to-end through
   * `verifyRegistrationResponse()`.
   *
   * @param clientData - The `CollectedClientData` payload to embed.
   * @param credentialId - Optional credential ID override to simulate replaying
   *   an already-registered credential ID paired with a different public key.
   * @returns The registration response in the JSON form posted by the client.
   */
  register(
    clientData: Record<string, unknown>,
    credentialId: string = this.id
  ): RegistrationResponseJSON {
    const clientDataJSON = Buffer.from(JSON.stringify(clientData));
    const credentialIdBytes = Buffer.from(credentialId, 'base64url');
    const credentialIdLength = Buffer.alloc(2);
    credentialIdLength.writeUInt16BE(credentialIdBytes.length, 0);
    const cosePublicKeyBytes = Buffer.from(this.cosePublicKey, 'base64url');

    const authData = Buffer.concat([
      crypto.createHash('sha256').update(config.hostname).digest(), // rpIdHash
      Buffer.from([0x45]), // flags: UP | UV | AT
      Buffer.alloc(4), // signCount: 0
      Buffer.alloc(16), // aaguid: zero
      credentialIdLength,
      credentialIdBytes,
      cosePublicKeyBytes,
    ]);

    // Encode CBOR map(3) { "fmt": "none", "attStmt": {}, "authData": <bstr> }.
    let bstrHeader: Buffer;
    if (authData.length < 24) {
      bstrHeader = Buffer.from([0x40 | authData.length]);
    } else if (authData.length <= 0xff) {
      bstrHeader = Buffer.from([0x58, authData.length]);
    } else {
      bstrHeader = Buffer.from([
        0x59,
        authData.length >> 8,
        authData.length & 0xff,
      ]);
    }

    const attestationObject = Buffer.concat([
      Buffer.from([0xa3, 0x63]),
      Buffer.from('fmt'),
      Buffer.from([0x64]),
      Buffer.from('none'),
      Buffer.from([0x67]),
      Buffer.from('attStmt'),
      Buffer.from([0xa0, 0x68]),
      Buffer.from('authData'),
      bstrHeader,
      authData,
    ]);

    return {
      id: credentialId,
      rawId: credentialId,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientDataJSON.toString('base64url'),
        attestationObject: attestationObject.toString('base64url'),
        transports: ['internal'],
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
      res.locals = mockSession.locals || {signin_status: 1}; // UserSignInStatus.SignedOut
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

  describe('removeKey and renameKey validation and ownership', () => {
    const ownerPasskeyUserId = crypto.randomBytes(16).toString('base64url');
    const otherPasskeyUserId = crypto.randomBytes(16).toString('base64url');
    const createdCredIds: string[] = [];

    afterAll(async () => {
      await Promise.all(
        createdCredIds.map(id => PublicKeyCredentials.remove(id))
      );
    });

    test('removeKey rejects invalid credId, blocks cross-user IDOR deletion, and deletes owned credential', async () => {
      const credId = `remove-test-${crypto.randomBytes(8).toString('base64url')}`;
      createdCredIds.push(credId);
      await PublicKeyCredentials.update({
        id: credId,
        passkeyUserId: ownerPasskeyUserId,
        name: 'Owner Key',
        credentialPublicKey: 'test-pub-key',
        credentialType: 'public-key',
        aaguid: '00000000-0000-0000-0000-000000000000',
        userVerified: true,
        transports: ['internal'],
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: true,
        registeredAt: Date.now(),
      });

      // Missing/invalid credId -> 400
      mockSession.locals = {
        signin_status: 5, // UserSignInStatus.RecentlySignedIn
        user: {passkeyUserId: ownerPasskeyUserId},
      };
      for (const badQuery of ['', '?credId=', '?credId=bad/slash']) {
        const badRes = await fetch(
          `http://127.0.0.1:${port}/webauthn/removeKey${badQuery}`,
          {
            method: 'POST',
            headers: {'X-Requested-With': 'XMLHttpRequest'},
          }
        );
        assert.strictEqual(badRes.status, 400);
      }

      // Cross-user IDOR attempt -> 401 and credential remains stored
      mockSession.locals = {
        signin_status: 5,
        user: {passkeyUserId: otherPasskeyUserId},
      };
      const idorRes = await fetch(
        `http://127.0.0.1:${port}/webauthn/removeKey?credId=${credId}`,
        {
          method: 'POST',
          headers: {'X-Requested-With': 'XMLHttpRequest'},
        }
      );
      assert.strictEqual(idorRes.status, 401);
      assert.ok(await PublicKeyCredentials.findById(credId));

      // Owner deletion -> 200 and credential removed
      mockSession.locals = {
        signin_status: 5,
        user: {passkeyUserId: ownerPasskeyUserId},
      };
      const okRes = await fetch(
        `http://127.0.0.1:${port}/webauthn/removeKey?credId=${credId}`,
        {
          method: 'POST',
          headers: {'X-Requested-With': 'XMLHttpRequest'},
        }
      );
      assert.strictEqual(okRes.status, 200);
      assert.strictEqual(
        await PublicKeyCredentials.findById(credId),
        undefined
      );
    });

    test('renameKey validates credId and newName and enforces ownership', async () => {
      const credId = `rename-test-${crypto.randomBytes(8).toString('base64url')}`;
      createdCredIds.push(credId);
      await PublicKeyCredentials.update({
        id: credId,
        passkeyUserId: ownerPasskeyUserId,
        name: 'Initial Name',
        credentialPublicKey: 'test-pub-key',
        credentialType: 'public-key',
        aaguid: '00000000-0000-0000-0000-000000000000',
        userVerified: true,
        transports: ['internal'],
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: true,
        registeredAt: Date.now(),
      });

      mockSession.locals = {
        signin_status: 5,
        user: {passkeyUserId: ownerPasskeyUserId},
      };

      for (const badCredId of ['', 'bad/slash', '__reserved__']) {
        const badCredRes = await fetch(
          `http://127.0.0.1:${port}/webauthn/renameKey`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({credId: badCredId, newName: 'Valid Name'}),
          }
        );
        assert.strictEqual(badCredRes.status, 400);
      }

      const badNameRes = await fetch(
        `http://127.0.0.1:${port}/webauthn/renameKey`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({credId, newName: '   '}),
        }
      );
      assert.strictEqual(badNameRes.status, 400);

      // Cross-user IDOR rename attempt -> 401
      mockSession.locals = {
        signin_status: 5,
        user: {passkeyUserId: otherPasskeyUserId},
      };
      const idorRenameRes = await fetch(
        `http://127.0.0.1:${port}/webauthn/renameKey`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({credId, newName: 'Hijacked Name'}),
        }
      );
      assert.strictEqual(idorRenameRes.status, 401);

      mockSession.locals = {
        signin_status: 5,
        user: {passkeyUserId: ownerPasskeyUserId},
      };

      const okRes = await fetch(`http://127.0.0.1:${port}/webauthn/renameKey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({credId, newName: '  Work Laptop  '}),
      });
      assert.strictEqual(okRes.status, 200);
      const updated = await okRes.json();
      assert.strictEqual(updated.name, 'Work Laptop');
    });
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

  test('signinRequest dynamically resolves rpId for App Engine PR preview host', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/webauthn/signinRequest`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-Forwarded-Host': 'pr-123-dot-project-sesame-426206.appspot.com',
        'X-Forwarded-Proto': 'https',
      },
    });

    const body = (await res.json()) as {rpId?: string};
    assert.strictEqual(res.status, 200);
    assert.strictEqual(
      body.rpId,
      'pr-123-dot-project-sesame-426206.appspot.com'
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

    test('rejects empty or malformed signinResponse bodies with 400 instead of 500', async () => {
      for (const badBody of [
        undefined,
        '{}',
        JSON.stringify({id: 'bad/slash', response: {}}),
        JSON.stringify({id: '__reserved__', response: {}}),
        JSON.stringify({id: passkey.id, response: null}),
      ]) {
        mockSession.challenge = crypto.randomBytes(32).toString('base64url');
        const res = await fetch(
          `http://127.0.0.1:${port}/webauthn/signinResponse`,
          {
            method: 'POST',
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              ...(badBody !== undefined
                ? {'Content-Type': 'application/json'}
                : {}),
            },
            ...(badBody !== undefined ? {body: badBody} : {}),
          }
        );
        assert.strictEqual(res.status, 400);
        assert.strictEqual(mockSession.challenge, undefined);
      }
    });

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

    test('rejects a cross-origin assertion from an unexpected embedder with 401', async () => {
      const {status, body} = await signIn({
        crossOrigin: true,
        topOrigin: 'https://evil.example',
      });
      assert.strictEqual(status, 401);
      assert.match(body.error, /top origin of "https:\/\/evil\.example"/);
      assert.strictEqual(mockSession.user, undefined, 'Must not sign in');
      assert.strictEqual(mockSession.challenge, undefined, 'Must consume');
    });

    test('rejects cross-origin assertions when no embedder is configured with 401', async () => {
      config.csp.frame_ancestors = [];
      const {status, body} = await signIn({
        crossOrigin: true,
        topOrigin: embedder,
      });
      assert.strictEqual(status, 401);
      assert.match(body.error, /expectedTopOrigin/);
      assert.strictEqual(mockSession.user, undefined, 'Must not sign in');
      assert.strictEqual(mockSession.challenge, undefined, 'Must consume');
    });

    test('accepts a cross-origin assertion without topOrigin (e.g. Safari)', async () => {
      const {status, body} = await signIn({crossOrigin: true});
      assert.strictEqual(status, 200, JSON.stringify(body));
    });

    test('rejects topOrigin on a same-origin assertion with 401', async () => {
      const {status, body} = await signIn({
        crossOrigin: false,
        topOrigin: embedder,
      });
      assert.strictEqual(status, 401);
      assert.match(body.error, /non-cross-origin/);
      assert.strictEqual(mockSession.challenge, undefined, 'Must consume');
    });

    test('rejects a mismatched challenge with 401 and consumes session challenge', async () => {
      const {status, body} = await signIn({
        challenge: 'wrong-challenge-value',
      });
      assert.strictEqual(status, 401);
      assert.match(body.error, /challenge/i);
      assert.strictEqual(mockSession.user, undefined, 'Must not sign in');
      assert.strictEqual(mockSession.challenge, undefined, 'Must consume');
    });

    test('returns 500 when verifyAuthenticationResponse throws PQCNotSupportedError', async () => {
      const pqcCredId = crypto.randomBytes(16).toString('base64url');
      const user = await Users.findById(userId);
      // CBOR COSE_Key map(3): {1 (kty): 7 (AKP), 3 (alg): -48 (ML-DSA-44), -1 (pub): bstr(0)}
      const mlDsaCosePublicKey = Buffer.from([
        0xa3, 0x01, 0x07, 0x03, 0x38, 0x2f, 0x20, 0x40,
      ]).toString('base64url');

      await PublicKeyCredentials.update({
        id: pqcCredId,
        passkeyUserId: user!.passkeyUserId!,
        credentialPublicKey: mlDsaCosePublicKey,
        credentialType: 'public-key',
        aaguid: '00000000-0000-0000-0000-000000000000',
        userVerified: true,
        transports: ['internal'],
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: true,
        registeredAt: Date.now(),
      });

      const pqcSpy = vi
        .spyOn(SettingsService, 'runtimeSupportsPQC')
        .mockReturnValue(false);

      try {
        const assertion = passkey.sign({
          type: 'webauthn.get',
          challenge: mockSession.challenge,
          origin: config.origin,
          crossOrigin: false,
        });
        assertion.id = pqcCredId;
        assertion.rawId = pqcCredId;

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
        const body = await res.json();
        assert.strictEqual(res.status, 500);
        assert.match(body.error, /ML-DSA-44/i);
        assert.strictEqual(mockSession.challenge, undefined, 'Must consume');
      } finally {
        pqcSpy.mockRestore();
        await PublicKeyCredentials.remove(pqcCredId);
      }
    });
  });

  describe('getKeys', () => {
    test('returns credentials with fallback icon when aaguid is unrecognized', async () => {
      const passkeyUserId = crypto.randomBytes(16).toString('base64url');
      const credId = crypto.randomBytes(16).toString('base64url');
      await PublicKeyCredentials.update({
        id: credId,
        passkeyUserId,
        credentialPublicKey: 'test-key',
        credentialType: 'public-key',
        aaguid: 'unknown-aaguid-1234',
        userVerified: true,
        transports: ['internal'],
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: true,
        registeredAt: Date.now(),
      });

      mockSession.locals = {
        signin_status: 4,
        user: {passkeyUserId},
      };

      const res = await fetch(`http://127.0.0.1:${port}/webauthn/getKeys`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.credentials.length, 1);
      const providerIcon: string = body.credentials[0].providerIcon;
      assert.ok(providerIcon.startsWith('data:image/svg+xml;base64,'));
      const base64Payload = providerIcon.split(',')[1];
      assert.strictEqual(base64Payload.length % 4, 0);

      await PublicKeyCredentials.remove(credId);
    });
  });

  describe('registerResponse credential ID uniqueness', () => {
    const victimPasskey = new SoftwarePasskey();
    const freshPasskey = new SoftwarePasskey();
    let victimUser: User;
    let attackerUser: User;
    const createdCredentialIds: string[] = [victimPasskey.id];
    const createdUserIds: string[] = [];

    beforeAll(async () => {
      const victimPasskeyUserId = crypto.randomBytes(16).toString('base64url');
      victimUser = await Users.create(`testuser-victim-${Date.now()}`, {
        passkeyUserId: victimPasskeyUserId,
      });
      createdUserIds.push(victimUser.id);

      const attackerPasskeyUserId = crypto
        .randomBytes(16)
        .toString('base64url');
      attackerUser = await Users.create(`testuser-attacker-${Date.now()}`, {
        passkeyUserId: attackerPasskeyUserId,
      });
      createdUserIds.push(attackerUser.id);

      await PublicKeyCredentials.create({
        id: victimPasskey.id,
        passkeyUserId: victimPasskeyUserId,
        credentialPublicKey: victimPasskey.cosePublicKey,
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
      await Promise.all(
        createdCredentialIds.map(id => PublicKeyCredentials.remove(id))
      );
      await Promise.all(createdUserIds.map(id => Users.delete(id)));
    });

    beforeEach(() => {
      mockSession.challenge = crypto.randomBytes(32).toString('base64url');
    });

    /**
     * Posts a passkey registration response to `/webauthn/registerResponse`.
     */
    async function postRegisterResponse(
      body: RegistrationResponseJSON
    ): Promise<{status: number; body: any}> {
      const res = await fetch(
        `http://127.0.0.1:${port}/webauthn/registerResponse`,
        {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
      return {status: res.status, body: await res.json()};
    }

    test('registers a new passkey when the credential ID is unused', async () => {
      mockSession.locals = {
        signin_status: UserSignInStatus.SignedIn,
        user: attackerUser,
        username: attackerUser.username,
      };
      createdCredentialIds.push(freshPasskey.id);

      const registration = freshPasskey.register({
        type: 'webauthn.create',
        challenge: mockSession.challenge,
        origin: config.origin,
      });
      const {status, body} = await postRegisterResponse(registration);

      assert.strictEqual(status, 200, JSON.stringify(body));
      assert.strictEqual(mockSession.challenge, undefined);

      const stored = await PublicKeyCredentials.findById(freshPasskey.id);
      assert.ok(stored);
      assert.strictEqual(stored.passkeyUserId, attackerUser.passkeyUserId);
      assert.strictEqual(
        stored.credentialPublicKey,
        freshPasskey.cosePublicKey
      );
    });

    test('rejects an attacker registering an existing credential ID from another user without overwriting it', async () => {
      const attackerPasskey = new SoftwarePasskey();
      mockSession.locals = {
        signin_status: UserSignInStatus.SignedIn,
        user: attackerUser,
        username: attackerUser.username,
      };

      const registration = attackerPasskey.register(
        {
          type: 'webauthn.create',
          challenge: mockSession.challenge,
          origin: config.origin,
        },
        victimPasskey.id
      );
      const {status, body} = await postRegisterResponse(registration);

      assert.strictEqual(status, 409);
      assert.strictEqual(body.error, 'Credential ID is already registered.');
      assert.strictEqual(mockSession.challenge, undefined);

      const victimStored = await PublicKeyCredentials.findById(
        victimPasskey.id
      );
      assert.ok(victimStored);
      assert.strictEqual(victimStored.passkeyUserId, victimUser.passkeyUserId);
      assert.strictEqual(
        victimStored.credentialPublicKey,
        victimPasskey.cosePublicKey
      );
    });

    test('rejects re-registration when the same user submits an existing credential ID', async () => {
      const replacementPasskey = new SoftwarePasskey();
      mockSession.locals = {
        signin_status: UserSignInStatus.SignedIn,
        user: victimUser,
        username: victimUser.username,
      };

      const registration = replacementPasskey.register(
        {
          type: 'webauthn.create',
          challenge: mockSession.challenge,
          origin: config.origin,
        },
        victimPasskey.id
      );
      const {status, body} = await postRegisterResponse(registration);

      assert.strictEqual(status, 409);
      assert.strictEqual(body.error, 'Credential ID is already registered.');
      assert.strictEqual(mockSession.challenge, undefined);

      const victimStored = await PublicKeyCredentials.findById(
        victimPasskey.id
      );
      assert.ok(victimStored);
      assert.strictEqual(
        victimStored.credentialPublicKey,
        victimPasskey.cosePublicKey
      );
    });

    test('rejects collision during SigningUp without creating a user or signing in', async () => {
      const signupUsername = `testuser-signup-collision-${Date.now()}`;
      const attackerPasskey = new SoftwarePasskey();
      mockSession.signup_user = {
        username: signupUsername,
        displayName: signupUsername,
        passkeyUserId: crypto.randomBytes(16).toString('base64url'),
      };
      mockSession.locals = {
        signin_status: UserSignInStatus.SigningUp,
        username: signupUsername,
      };

      const registration = attackerPasskey.register(
        {
          type: 'webauthn.create',
          challenge: mockSession.challenge,
          origin: config.origin,
        },
        victimPasskey.id
      );
      const {status, body} = await postRegisterResponse(registration);

      assert.strictEqual(status, 409);
      assert.strictEqual(body.error, 'Credential ID is already registered.');
      assert.strictEqual(mockSession.challenge, undefined);
      assert.strictEqual(mockSession.user, undefined);

      const createdUser = await Users.findByUsername(signupUsername);
      assert.strictEqual(createdUser, undefined);

      const victimStored = await PublicKeyCredentials.findById(
        victimPasskey.id
      );
      assert.ok(victimStored);
      assert.strictEqual(victimStored.passkeyUserId, victimUser.passkeyUserId);
      assert.strictEqual(
        victimStored.credentialPublicKey,
        victimPasskey.cosePublicKey
      );
    });

    test('returns 409 when atomic create loses a concurrent write race after findById', async () => {
      const racingPasskey = new SoftwarePasskey();
      mockSession.locals = {
        signin_status: UserSignInStatus.SignedIn,
        user: attackerUser,
        username: attackerUser.username,
      };

      const findByIdSpy = vi
        .spyOn(PublicKeyCredentials, 'findById')
        .mockResolvedValueOnce(undefined);

      try {
        const registration = racingPasskey.register(
          {
            type: 'webauthn.create',
            challenge: mockSession.challenge,
            origin: config.origin,
          },
          victimPasskey.id
        );
        const {status, body} = await postRegisterResponse(registration);

        assert.strictEqual(status, 409);
        assert.strictEqual(body.error, 'Credential ID is already registered.');
        assert.strictEqual(mockSession.challenge, undefined);
      } finally {
        findByIdSpy.mockRestore();
      }
    });

    test('returns 400 when registration verification fails for non-collision reasons', async () => {
      const invalidPasskey = new SoftwarePasskey();
      mockSession.locals = {
        signin_status: UserSignInStatus.SignedIn,
        user: attackerUser,
        username: attackerUser.username,
      };

      const registration = invalidPasskey.register({
        type: 'webauthn.create',
        challenge: 'wrong-challenge-value',
        origin: config.origin,
      });
      const {status, body} = await postRegisterResponse(registration);

      assert.strictEqual(status, 400);
      assert.match(body.error, /challenge/i);
      assert.strictEqual(mockSession.challenge, undefined);
    });
  });
});
