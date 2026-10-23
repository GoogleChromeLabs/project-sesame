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

import {describe, test, beforeEach, afterEach, vi, expect} from 'vitest';
import assert from 'node:assert';
import express, {Request, Response, NextFunction} from 'express';
import http from 'http';
import {email} from './email.ts';
import * as evpLib from '../libs/evp.ts';

const originalFetch = global.fetch;

describe('Email Middleware', () => {
  let server: http.Server;
  let port: number;
  let mockSession: Record<string, any>;

  beforeEach(async () => {
    mockSession = {
      challenge: 'test-session-challenge',
    };

    const app = express();
    app.use(express.json());

    // Mock session middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
      req.session = mockSession as any;
      res.locals = {signin_status: 0};
      next();
    });

    app.use('/email', email);

    server = http.createServer(app);
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as import('net').AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
    vi.restoreAllMocks();
  });

  test('POST /email/verify returns 400 when X-Requested-With header is missing (csrfCheck)', async () => {
    const res = await originalFetch(`http://127.0.0.1:${port}/email/verify`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'test@gmail.com', evt: 'mock-evt'}),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error, 'Invalid XHR request.');
  });

  test('POST /email/verify returns 400 on missing parameters', async () => {
    const res = await originalFetch(`http://127.0.0.1:${port}/email/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({email: 'test@gmail.com'}),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error, 'Missing email or token (evt)');
  });

  test('POST /email/verify returns 400 when session challenge is missing', async () => {
    delete mockSession.challenge;

    const res = await originalFetch(`http://127.0.0.1:${port}/email/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({email: 'test@gmail.com', evt: 'mock-evt'}),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(
      body.error,
      'No active verification challenge found in session.'
    );
  });

  test('POST /email/verify delegates to verifyEvpToken and returns result', async () => {
    const mockResult: evpLib.VerifyEvpTokenResult = {
      success: true,
      verifiedEmail: 'test@gmail.com',
      steps: {
        step1: {status: 'success', inputs: {}, outputs: {}},
        step2: {status: 'success', inputs: {}, outputs: {}},
        step3: {status: 'success', inputs: {}, outputs: {}},
        step4: {status: 'success', inputs: {}, outputs: {}},
        step5: {status: 'success', inputs: {}, outputs: {}},
        step6: {status: 'success', inputs: {}, outputs: {}},
      },
    };

    const spy = vi
      .spyOn(evpLib, 'verifyEvpToken')
      .mockResolvedValue(mockResult);

    const res = await originalFetch(`http://127.0.0.1:${port}/email/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({email: 'test@gmail.com', evt: 'mock-evt'}),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.verifiedEmail, 'test@gmail.com');
    assert.strictEqual(mockSession.challenge, undefined);

    expect(spy).toHaveBeenCalledWith({
      email: 'test@gmail.com',
      evt: 'mock-evt',
      expectedAudience: `http://127.0.0.1:${port}`,
      expectedNonce: 'test-session-challenge',
    });
  });
});
