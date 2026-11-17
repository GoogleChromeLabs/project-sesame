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

const mockLoadingStop = vi.fn();
const mockRedirect = vi.fn();
const mockToast = vi.fn();
const mockRegisterCredential = vi.fn();

type PostFormSuccess = () => Promise<void>;
type PostFormError = (error: Error) => void;
type PostFormValidate = (form: FormData) => string | undefined;

let capturedSuccess: PostFormSuccess | undefined;
let capturedError: PostFormError | undefined;
let capturedValidate: PostFormValidate | undefined;

let mockCapabilities:
  | {
      userVerifyingPlatformAuthenticator?: boolean;
      conditionalGet?: boolean;
    }
  | undefined;

vi.mock('~project-sesame/client/layout', () => ({}));

vi.mock('~project-sesame/client/helpers/index', () => ({
  loading: {
    start: vi.fn(),
    stop: (...args: unknown[]) => mockLoadingStop(...args),
  },
  redirect: (...args: unknown[]) => mockRedirect(...args),
  toast: (...args: unknown[]) => mockToast(...args),
  postForm: (
    onSuccess: PostFormSuccess,
    onError: PostFormError,
    validate: PostFormValidate
  ) => {
    capturedSuccess = onSuccess;
    capturedError = onError;
    capturedValidate = validate;
  },
}));

vi.mock('~project-sesame/client/helpers/publickey', () => ({
  get capabilities() {
    return mockCapabilities;
  },
  registerCredential: (...args: unknown[]) => mockRegisterCredential(...args),
}));

describe('passkey-signup page', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    capturedSuccess = undefined;
    capturedError = undefined;
    capturedValidate = undefined;
    mockCapabilities = {
      userVerifyingPlatformAuthenticator: true,
      conditionalGet: true,
    };
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('redirects to /home when passkey registration succeeds', async () => {
    mockRegisterCredential.mockResolvedValueOnce({});
    await import('~project-sesame/client/pages/passkey-signup.js');

    await capturedSuccess!();

    expect(mockRegisterCredential).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith('/home');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('stops loading and shows toast on InvalidStateError', async () => {
    mockRegisterCredential.mockRejectedValueOnce(
      new DOMException('Already registered', 'InvalidStateError')
    );
    await import('~project-sesame/client/pages/passkey-signup.js');

    await capturedSuccess!();

    expect(mockLoadingStop).toHaveBeenCalledOnce();
    expect(mockToast).toHaveBeenCalledWith(
      'A passkey already exists for this device.'
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('stops loading without showing toast on NotAllowedError', async () => {
    mockRegisterCredential.mockRejectedValueOnce(
      new DOMException('The operation was cancelled.', 'NotAllowedError')
    );
    await import('~project-sesame/client/pages/passkey-signup.js');

    await capturedSuccess!();

    expect(mockLoadingStop).toHaveBeenCalledOnce();
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('stops loading and shows toast message on generic Error', async () => {
    const err = new Error('Network failure');
    mockRegisterCredential.mockRejectedValueOnce(err);
    await import('~project-sesame/client/pages/passkey-signup.js');

    await capturedSuccess!();

    expect(mockLoadingStop).toHaveBeenCalledOnce();
    expect(mockToast).toHaveBeenCalledWith('Network failure');
    expect(consoleErrorSpy).toHaveBeenCalledWith(err);
  });

  it('stops loading and falls back to error property on non-Error rejection', async () => {
    mockRegisterCredential.mockRejectedValueOnce({
      error: 'Invalid challenge',
      status: 400,
    });
    await import('~project-sesame/client/pages/passkey-signup.js');

    await capturedSuccess!();

    expect(mockLoadingStop).toHaveBeenCalledOnce();
    expect(mockToast).toHaveBeenCalledWith('Invalid challenge');
  });

  it('stops loading and redirects to /new-password when passkeys are unsupported', async () => {
    mockCapabilities = {
      userVerifyingPlatformAuthenticator: false,
      conditionalGet: false,
    };
    await import('~project-sesame/client/pages/passkey-signup.js');

    await capturedSuccess!();

    expect(mockRegisterCredential).not.toHaveBeenCalled();
    expect(mockLoadingStop).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith('/new-password');
  });

  it('validates non-empty username and stops loading on form error callback', async () => {
    await import('~project-sesame/client/pages/passkey-signup.js');

    const emptyForm = new FormData();
    emptyForm.set('username', '   ');
    expect(capturedValidate!(emptyForm)).toBe('Please enter a username.');

    const validForm = new FormData();
    validForm.set('username', 'alice');
    expect(capturedValidate!(validForm)).toBeUndefined();

    capturedError!(new Error('The username is already taken.'));
    expect(mockLoadingStop).toHaveBeenCalledOnce();
    expect(mockToast).toHaveBeenCalledWith('The username is already taken.');
  });
});
