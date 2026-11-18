/*
 * @license
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

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import express, {NextFunction, Request, Response} from 'express';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import jwt from 'jsonwebtoken';
import {LoginTicket} from 'google-auth-library';
import {federation, googleClient} from './federation.ts';
import {
  IdentityProvider,
  IdentityProviders,
} from '../libs/identity-providers.ts';
import {UserSignInStatus} from '../libs/session.ts';
import {Users} from '../libs/users.ts';

describe('Federation Middleware', () => {
  let server: http.Server;
  let port: number;
  let mockSession: Record<string, any>;
  let mockSigninStatus: UserSignInStatus;
  let originalIdps: IdentityProvider[];
  const createdUserIds: string[] = [];

  const demoIdp: IdentityProvider = {
    name: 'Demo IdP',
    origin: 'https://idp.example.com',
    configURL: 'https://idp.example.com/fedcm/config.json',
    clientId: 'https://rp.example.com',
    secret: 'demo-idp-shared-secret',
  };

  const googleIdp: IdentityProvider = {
    name: 'Google',
    origin: 'https://accounts.google.com',
    configURL: 'https://accounts.google.com/gsi/fedcm.json',
    clientId: 'google-client-id.apps.googleusercontent.com',
    secret: 'unused',
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req: Request, res: Response, next: NextFunction) => {
      req.session = mockSession as any;
      res.locals = {
        signin_status: mockSigninStatus,
      };
      next();
    });
    app.use('/federation', federation);

    server = http.createServer(app);
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    originalIdps = [...IdentityProviders.idps];
    IdentityProviders.idps = [demoIdp, googleIdp];
    mockSession = {challenge: 'session-nonce-123'};
    mockSigninStatus = UserSignInStatus.SignedOut;
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    IdentityProviders.idps = originalIdps;
    await Promise.all(
      createdUserIds.splice(0).map(id => Users.delete(id).catch(() => {}))
    );
  });

  describe('POST /federation/options', () => {
    it('rejects missing, oversized, or non-string urls arrays with 400 and returns empty idps for empty array', async () => {
      for (const body of [
        {},
        {urls: 'https://idp.example.com'},
        {urls: [123]},
        {urls: Array.from({length: 51}, () => demoIdp.origin)},
      ]) {
        const res = await fetch(`http://127.0.0.1:${port}/federation/options`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(400);
      }

      const emptyRes = await fetch(
        `http://127.0.0.1:${port}/federation/options`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({urls: []}),
        }
      );
      expect(emptyRes.status).toBe(200);
      expect(await emptyRes.json()).toEqual({idps: []});
    });

    it('returns matching IdPs with secrets stripped', async () => {
      const res = await fetch(`http://127.0.0.1:${port}/federation/options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({urls: [demoIdp.origin]}),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.idps).toHaveLength(1);
      expect(data.idps[0].origin).toBe(demoIdp.origin);
      expect(data.idps[0].secret).toBe('');
      // Verify static store secret was not mutated
      expect(IdentityProviders.idps[0].secret).toBe('demo-idp-shared-secret');
    });
  });

  describe('POST /federation/verifyIdToken', () => {
    it('returns 400 when token or url is missing, non-string, or malformed URL without consuming challenge', async () => {
      for (const body of [
        {},
        {token: '', url: demoIdp.origin},
        {token: 'abc', url: ''},
        {token: 123, url: demoIdp.origin},
        {token: 'abc.def.ghi', url: 'not-a-valid-url'},
        {token: 'abc.def.ghi', url: 'javascript:alert(1)'},
      ]) {
        const res = await fetch(
          `http://127.0.0.1:${port}/federation/verifyIdToken`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(body),
          }
        );
        expect(res.status).toBe(400);
        expect(mockSession.challenge).toBe('session-nonce-123');
      }
    });

    it('fails closed with 400 when no session challenge exists', async () => {
      delete mockSession.challenge;
      const res = await fetch(
        `http://127.0.0.1:${port}/federation/verifyIdToken`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({token: 'some.jwt.token', url: demoIdp.origin}),
        }
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid nonce.');
    });

    it('rejects Google ID tokens when payload nonce is missing/mismatched or email_verified is not true, consuming the challenge', async () => {
      for (const invalidClaims of [
        {nonce: 'wrong-nonce', email_verified: true},
        {nonce: undefined, email_verified: true},
        {nonce: 'session-nonce-123', email_verified: false},
        {nonce: 'session-nonce-123', email_verified: undefined},
      ]) {
        mockSession = {challenge: 'session-nonce-123'};
        vi.spyOn(
          googleClient as unknown as {
            verifyIdToken: () => Promise<LoginTicket>;
          },
          'verifyIdToken'
        ).mockResolvedValueOnce(
          new LoginTicket('env', {
            iss: 'https://accounts.google.com',
            sub: 'google-sub-1',
            aud: googleIdp.clientId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
            email: `fedtest-invalid-${Date.now()}@example.com`,
            ...invalidClaims,
          })
        );

        const res = await fetch(
          `http://127.0.0.1:${port}/federation/verifyIdToken`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
              token: 'google.id.token',
              url: googleIdp.origin,
            }),
          }
        );

        expect(res.status).toBe(401);
        expect(mockSession.challenge).toBeUndefined();
      }
    });

    it('rejects unsigned alg:none custom IdP tokens with 401', async () => {
      const header = Buffer.from(
        JSON.stringify({alg: 'none', typ: 'JWT'})
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          iss: demoIdp.origin,
          sub: 'demo-sub-none',
          aud: demoIdp.clientId,
          nonce: 'session-nonce-123',
          email: 'forged@example.com',
        })
      ).toString('base64url');
      const unsignedToken = `${header}.${payload}.`;

      const res = await fetch(
        `http://127.0.0.1:${port}/federation/verifyIdToken`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({token: unsignedToken, url: demoIdp.origin}),
        }
      );

      expect(res.status).toBe(401);
      expect(mockSession.challenge).toBeUndefined();
    });

    it('accepts Google ID tokens when payload nonce matches the session challenge', async () => {
      const email = `fedtest-google-${Date.now()}@example.com`;
      vi.spyOn(
        googleClient as unknown as {
          verifyIdToken: () => Promise<LoginTicket>;
        },
        'verifyIdToken'
      ).mockResolvedValueOnce(
        new LoginTicket('env', {
          iss: 'https://accounts.google.com',
          sub: 'google-sub-2',
          aud: googleIdp.clientId,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          email,
          email_verified: true,
          name: 'Google Tester',
          nonce: 'session-nonce-123',
        })
      );

      const res = await fetch(
        `http://127.0.0.1:${port}/federation/verifyIdToken`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            token: 'google.id.token',
            url: googleIdp.origin,
          }),
        }
      );

      expect(res.status).toBe(200);
      const user = await res.json();
      createdUserIds.push(user.id);
      expect(user.username).toBe(email);
      expect(mockSession.challenge).toBeUndefined();
      expect(res.headers.get('set-login')).toBe('logged-in');
    });

    it('verifies custom IdP HS256 JWTs and rejects replay on a second call', async () => {
      const email = `fedtest-custom-${Date.now()}@example.com`;
      const token = jwt.sign(
        {
          iss: demoIdp.origin,
          sub: 'demo-sub-1',
          aud: demoIdp.clientId,
          nonce: 'session-nonce-123',
          email,
          name: 'Demo Federated User',
        },
        demoIdp.secret,
        {algorithm: 'HS256', expiresIn: '1h'}
      );

      const first = await fetch(
        `http://127.0.0.1:${port}/federation/verifyIdToken`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({token, url: demoIdp.origin}),
        }
      );
      expect(first.status).toBe(200);
      const created = await first.json();
      createdUserIds.push(created.id);

      // Replay with same session (challenge already consumed) fails closed with 400
      const replay = await fetch(
        `http://127.0.0.1:${port}/federation/verifyIdToken`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({token, url: demoIdp.origin}),
        }
      );
      expect(replay.status).toBe(400);
    });
  });
});
