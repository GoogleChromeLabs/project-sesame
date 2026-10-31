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

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {config} from '../config.ts';
import {logger, logContextStorage} from './logger.ts';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalDebug: boolean;

  beforeEach(() => {
    originalDebug = config.debug;
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    config.debug = originalDebug;
    consoleLogSpy.mockRestore();
  });

  it('suppresses DEBUG logs when config.debug is false', () => {
    config.debug = false;

    logger.debug('Hidden debug log', {foo: 'bar'});

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('outputs single-line JSON with redacted sensitive fields when config.debug is false', () => {
    config.debug = false;

    logContextStorage.run({path: '/auth/signin'}, () => {
      logger.info('Sign-in attempt', {
        username: 'alice',
        password: 'super-secret-password',
        status: 200,
      });
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const loggedArg = consoleLogSpy.mock.calls[0][0] as string;
    expect(loggedArg).not.toContain('\n');

    const parsed = JSON.parse(loggedArg);
    expect(parsed).toEqual({
      severity: 'INFO',
      message: 'Sign-in attempt',
      path: '/auth/signin',
      username: '[REDACTED]',
      password: '[REDACTED]',
      status: 200,
    });
  });

  it('serializes Error instances into entry.error when config.debug is false', () => {
    config.debug = false;
    const err = new TypeError('Invalid token');

    logger.error('Verification failed', err);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
    expect(parsed.severity).toBe('ERROR');
    expect(parsed.message).toBe('Verification failed');
    expect(parsed.error).toMatchObject({
      name: 'TypeError',
      message: 'Invalid token',
    });
  });

  it('ignores logs for /rsbuild-hmr path', () => {
    config.debug = true;

    logContextStorage.run({path: '/rsbuild-hmr'}, () => {
      logger.info('HMR ping');
    });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('logs human-readable output when config.debug is true', () => {
    config.debug = true;

    logContextStorage.run({path: '/home'}, () => {
      logger.warn('Session expiring soon', 'in 5m');
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenNthCalledWith(1, 'WARNING: [/home]');
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      2,
      'Session expiring soon',
      'in 5m'
    );
  });
});
