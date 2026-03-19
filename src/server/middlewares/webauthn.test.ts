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

import {test, describe, before, after, beforeEach} from 'node:test';
import assert from 'node:assert';
import express, {Request, Response, NextFunction} from 'express';
import {webauthn} from './webauthn.ts';
import http from 'http';

describe('WebAuthn Middlewares', () => {
  let app: express.Express;
  let server: http.Server;
  let port: number;
  let mockSession: any = {};

  before(async () => {
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

  after(() => {
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
});
