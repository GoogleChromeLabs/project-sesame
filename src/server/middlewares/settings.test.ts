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

import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import express, {Request, Response, NextFunction} from 'express';
import path from 'node:path';
import {settings} from '~project-sesame/server/middlewares/settings.ts';
import {UserSignInStatus} from '~project-sesame/server/libs/session.ts';

describe('Settings Middleware', () => {
  let app: express.Express;
  let server: http.Server;
  let port: number;
  let mockSigninStatus: UserSignInStatus = UserSignInStatus.SignedOut;
  let mockEntrance: string | undefined = undefined;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.engine('html', (_path: string, _options: any, callback: Function) => {
      callback(null, '<html>Mock View</html>');
    });
    app.set('view engine', 'html');
    app.set('views', path.join(process.cwd(), 'src/shared/views'));
    app.use((req: Request, res: Response, next: NextFunction) => {
      req.session = (mockEntrance ? {entrance: mockEntrance} : {}) as any;
      res.locals = {
        signin_status: mockSigninStatus,
        is_signed_in: mockSigninStatus >= UserSignInStatus.SignedIn,
        narrow: false,
      };
      next();
    });
    app.use('/settings', settings);

    server = http.createServer(app);
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('redirects /settings to /home', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/settings`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/home');
  });

  it('redirects unauthenticated /settings/passkeys access to /passkey-form-autofill with return URL when no entrance is set', async () => {
    mockSigninStatus = UserSignInStatus.SignedOut;
    mockEntrance = undefined;
    const res = await fetch(`http://127.0.0.1:${port}/settings/passkeys`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      '/passkey-form-autofill?r=%2Fsettings%2Fpasskeys'
    );
  });

  it('redirects unauthenticated /settings/passkeys access to recorded session entrance with return URL', async () => {
    mockSigninStatus = UserSignInStatus.SignedOut;
    mockEntrance = '/signin-form';
    const res = await fetch(`http://127.0.0.1:${port}/settings/passkeys`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      '/signin-form?r=%2Fsettings%2Fpasskeys'
    );
    mockEntrance = undefined;
  });

  it('renders passkeys settings page when user is recently signed in', async () => {
    mockSigninStatus = UserSignInStatus.RecentlySignedIn;
    const res = await fetch(`http://127.0.0.1:${port}/settings/passkeys`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Mock View');
  });
});
