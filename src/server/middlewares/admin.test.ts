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

import {describe, it, afterEach} from 'vitest';
import assert from 'node:assert';
import {cronCheck} from './admin.ts';
import type {Request, Response, NextFunction} from 'express';

describe('Admin Cron Middleware (cronCheck)', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('blocks requests without X-Appengine-Cron header in production', () => {
    process.env.NODE_ENV = 'prod';
    let statusCode: number | undefined;
    let jsonResponse: any;
    let nextCalled = false;

    const req = {
      path: '/delete-all-users',
      ip: '127.0.0.1',
      header: () => undefined,
    } as unknown as Request;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonResponse = data;
          },
        };
      },
    } as unknown as Response;

    const next: NextFunction = () => {
      nextCalled = true;
    };

    cronCheck(req, res, next);

    assert.strictEqual(statusCode, 403);
    assert.deepStrictEqual(jsonResponse, {error: 'Forbidden'});
    assert.strictEqual(nextCalled, false);
  });

  it('allows requests with X-Appengine-Cron: true in production', () => {
    process.env.NODE_ENV = 'prod';
    let nextCalled = false;

    const req = {
      path: '/delete-all-users',
      ip: '127.0.0.1',
      header: (name: string) =>
        name === 'X-Appengine-Cron' ? 'true' : undefined,
    } as unknown as Request;

    const res = {} as Response;

    const next: NextFunction = () => {
      nextCalled = true;
    };

    cronCheck(req, res, next);

    assert.strictEqual(nextCalled, true);
  });

  it('blocks requests without X-Appengine-Cron header in staging', () => {
    process.env.NODE_ENV = 'staging';
    let statusCode: number | undefined;
    let nextCalled = false;

    const req = {
      path: '/delete-all-users',
      ip: '127.0.0.1',
      header: () => undefined,
    } as unknown as Request;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: () => {},
        };
      },
    } as unknown as Response;

    const next: NextFunction = () => {
      nextCalled = true;
    };

    cronCheck(req, res, next);

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(nextCalled, false);
  });

  it('allows requests without header in local development', () => {
    process.env.NODE_ENV = 'localhost';
    let nextCalled = false;

    const req = {
      path: '/delete-all-users',
      ip: '127.0.0.1',
      header: () => undefined,
    } as unknown as Request;

    const res = {} as Response;

    const next: NextFunction = () => {
      nextCalled = true;
    };

    cronCheck(req, res, next);

    assert.strictEqual(nextCalled, true);
  });
});
