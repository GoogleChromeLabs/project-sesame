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

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import express, {Request, Response, NextFunction} from 'express';
import {auth} from '~project-sesame/server/middlewares/auth.ts';
import {Users} from '~project-sesame/server/libs/users.ts';
import {UserSignInStatus} from '~project-sesame/server/libs/session.ts';

vi.mock('~project-sesame/server/libs/session.ts', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('~project-sesame/server/libs/session.ts')
    >();
  return {
    ...actual,
    apiAclCheck: () => (_req: Request, _res: Response, next: NextFunction) =>
      next(),
  };
});

describe('Auth Middleware - /userinfo and /updateDisplayName', () => {
  let app: express.Express;
  let server: http.Server;
  let port: number;
  const mockUser = {
    id: 'user-123',
    username: 'alice@example.com',
    displayName: 'Alice',
    passkeyUserId: 'passkey-user-123',
    picture: 'https://example.com/alice.png',
    registeredAt: 1700000000000,
    expiresAt: 1700086400000,
    approved_clients: [],
  };

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use((_req: Request, res: Response, next: NextFunction) => {
      res.locals = {
        signin_status: UserSignInStatus.SignedIn,
        is_signed_in: true,
        user: {...mockUser},
        narrow: false,
      };
      next();
    });
    app.use('/auth', auth);

    server = http.createServer(app);
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /auth/userinfo returns user properties and rpId', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/auth/userinfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: 'user-123',
      username: 'alice@example.com',
      displayName: 'Alice',
      passkeyUserId: 'passkey-user-123',
      rpId: expect.any(String),
    });
  });

  it('POST /auth/updateDisplayName updates user displayName and returns user with rpId', async () => {
    const updateSpy = vi
      .spyOn(Users, 'update')
      .mockResolvedValueOnce({...mockUser, displayName: 'Alice New'});

    const res = await fetch(`http://127.0.0.1:${port}/auth/updateDisplayName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({newName: 'Alice New'}),
    });

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-123',
        displayName: 'Alice New',
      })
    );
    const body = await res.json();
    expect(body).toMatchObject({
      id: 'user-123',
      username: 'alice@example.com',
      displayName: 'Alice New',
      passkeyUserId: 'passkey-user-123',
      rpId: expect.any(String),
    });
  });
});
