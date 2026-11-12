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
import {Users} from '../libs/users.ts';

const originalFetch = global.fetch;

/**
 * Builds a result as returned by `verifyEvpToken()`, with every step in the
 * same state.
 *
 * @param success - Whether the token passed verification.
 * @param verifiedEmail - The email address in the token.
 * @param error - The error message for a failed verification.
 * @returns The verification result.
 */
function verificationResult(
  success: boolean,
  verifiedEmail = '',
  error?: string
): evpLib.VerifyEvpTokenResult {
  const status = success ? 'success' : 'failed';
  const step = (): evpLib.EvpVerificationStep => ({
    status,
    inputs: {},
    outputs: {},
  });
  return {
    success,
    verifiedEmail,
    error,
    steps: {
      step1: step(),
      step2: step(),
      step3: step(),
      step4: step(),
      step5: step(),
      step6: step(),
    },
  };
}

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

    // By default, no account exists for the email being signed up.
    vi.spyOn(Users, 'findByUsername').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
    vi.restoreAllMocks();
  });

  /**
   * Sends a JSON POST request with the XHR header that `csrfCheck` requires.
   *
   * @param path - The request path.
   * @param payload - The JSON body.
   * @returns The fetch response.
   */
  function postJson(
    path: string,
    payload: object
  ): Promise<globalThis.Response> {
    return originalFetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    });
  }

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

  test('POST /email/verify does not start a sign-up', async () => {
    vi.spyOn(evpLib, 'verifyEvpToken').mockResolvedValue(
      verificationResult(true, 'test@gmail.com')
    );

    const res = await postJson('/email/verify', {
      email: 'test@gmail.com',
      evt: 'mock-evt',
    });

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(mockSession.signup_user, undefined);
  });

  test('POST /email/signup starts a passwordless sign-up for the verified address', async () => {
    const spy = vi
      .spyOn(evpLib, 'verifyEvpToken')
      .mockResolvedValue(verificationResult(true, 'Test@Gmail.com'));

    const res = await postJson('/email/signup', {
      email: 'test@gmail.com',
      evt: 'mock-evt',
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true, body.error);
    assert.strictEqual(body.verifiedEmail, 'test@gmail.com');
    assert.strictEqual(body.steps.step6.status, 'success');
    assert.strictEqual(mockSession.signup_user.username, 'test@gmail.com');
    assert.strictEqual(mockSession.signup_user.email, 'test@gmail.com');
    assert.ok(mockSession.signup_user.passkeyUserId);
    assert.strictEqual(mockSession.challenge, undefined);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({expectedNonce: 'test-session-challenge'})
    );
  });

  test('POST /email/signup rejects an email that already has an account', async () => {
    vi.spyOn(evpLib, 'verifyEvpToken').mockResolvedValue(
      verificationResult(true, 'test@gmail.com')
    );
    vi.mocked(Users.findByUsername).mockResolvedValue({
      id: 'existing',
      username: 'test@gmail.com',
    } as any);

    const res = await postJson('/email/signup', {
      email: 'test@gmail.com',
      evt: 'mock-evt',
    });

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('already exists'));
    assert.strictEqual(body.verifiedEmail, '');
    assert.strictEqual(mockSession.signup_user, undefined);
    assert.strictEqual(mockSession.challenge, undefined);
  });

  test('POST /email/signup does not start a sign-up when verification fails', async () => {
    vi.spyOn(evpLib, 'verifyEvpToken').mockResolvedValue(
      verificationResult(false, '', 'Invalid token format')
    );

    const res = await postJson('/email/signup', {
      email: 'test@gmail.com',
      evt: 'mock-evt',
    });

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, 'Invalid token format');
    assert.strictEqual(mockSession.signup_user, undefined);
    // A failed attempt still uses up the challenge.
    assert.strictEqual(mockSession.challenge, undefined);
    expect(Users.findByUsername).not.toHaveBeenCalled();
  });

  test('POST /email/signup fails closed when the session has no challenge', async () => {
    delete mockSession.challenge;
    const spy = vi.spyOn(evpLib, 'verifyEvpToken');

    const res = await postJson('/email/signup', {
      email: 'test@gmail.com',
      evt: 'mock-evt',
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(
      body.error,
      'No active verification challenge found in session.'
    );
    assert.strictEqual(mockSession.signup_user, undefined);
    expect(spy).not.toHaveBeenCalled();
  });

  test('POST /email/otp/request stores the normalized email as pending', async () => {
    const res = await postJson('/email/otp/request', {
      email: ' Someone@Example.com ',
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(mockSession.pending_email, 'someone@example.com');
    assert.strictEqual(mockSession.signup_user, undefined);
  });

  test('POST /email/otp/request requires the page challenge', async () => {
    delete mockSession.challenge;

    const res = await postJson('/email/otp/request', {
      email: 'someone@example.com',
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.ok(body.error.includes('Reload the page'));
    assert.strictEqual(mockSession.pending_email, undefined);
  });

  test('POST /email/otp/request rejects an invalid email address', async () => {
    const res = await postJson('/email/otp/request', {email: 'not-an-email'});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(mockSession.pending_email, undefined);
  });

  test('POST /email/otp accepts a 6-digit code for the pending email', async () => {
    mockSession.pending_email = 'someone@example.com';

    const res = await postJson('/email/otp', {
      // A client-supplied address must be ignored.
      email: 'attacker@example.com',
      otp: '123456',
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.verifiedEmail, 'someone@example.com');
    assert.strictEqual(mockSession.signup_user.username, 'someone@example.com');
    assert.ok(mockSession.signup_user.passkeyUserId);
    assert.strictEqual(mockSession.pending_email, undefined);
    assert.strictEqual(mockSession.challenge, undefined);
  });

  test('POST /email/otp rejects a malformed code', async () => {
    mockSession.pending_email = 'someone@example.com';

    const res = await postJson('/email/otp', {otp: '12ab'});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(mockSession.signup_user, undefined);
    assert.strictEqual(mockSession.pending_email, 'someone@example.com');
  });

  test('POST /email/otp requires a pending email', async () => {
    const res = await postJson('/email/otp', {
      email: 'someone@example.com',
      otp: '123456',
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.ok(body.error.includes('Start over'));
    assert.strictEqual(mockSession.signup_user, undefined);
  });
});
