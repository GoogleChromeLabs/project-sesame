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

const mockPost = vi.fn();

vi.mock('webauthn-polyfills', () => ({}));
vi.mock('~project-sesame/client/helpers/index', () => ({
  post: (...args: unknown[]) => mockPost(...args),
}));

describe('verifyPublicKeyCreationResult', () => {
  const mockSignalUnknownCredential = vi.fn();
  const mockGetClientCapabilities = vi.fn();

  function createMockCredential(id = 'cred-123'): PublicKeyCredential {
    return {
      id,
      rawId: new ArrayBuffer(0),
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: {} as AuthenticatorResponse,
      getClientExtensionResults: () => ({}),
      toJSON: () => ({
        id,
        rawId: id,
        type: 'public-key',
        response: {
          clientDataJSON: 'client-data',
          attestationObject: 'attestation',
        },
        clientExtensionResults: {},
      }),
    } as unknown as PublicKeyCredential;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockGetClientCapabilities.mockResolvedValue({});
    mockSignalUnknownCredential.mockResolvedValue(undefined);

    const mockPublicKeyCredential = {
      getClientCapabilities: mockGetClientCapabilities,
      signalUnknownCredential: mockSignalUnknownCredential,
    };

    vi.stubGlobal('PublicKeyCredential', mockPublicKeyCredential);
    vi.stubGlobal('window', {
      PublicKeyCredential: mockPublicKeyCredential,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the server response on successful registration without signaling', async () => {
    const {verifyPublicKeyCreationResult} = await import('./publickey.js');
    const cred = createMockCredential('cred-ok');
    mockPost.mockResolvedValueOnce({id: 'user-1', username: 'alice'});

    const result = await verifyPublicKeyCreationResult(
      cred,
      'rp.localhost',
      false
    );

    expect(mockPost).toHaveBeenCalledWith(
      '/webauthn/registerResponse',
      cred.toJSON()
    );
    expect(result).toEqual({id: 'user-1', username: 'alice'});
    expect(mockSignalUnknownCredential).not.toHaveBeenCalled();
  });

  it('signals unknown credential when registration fails with 400', async () => {
    const {verifyPublicKeyCreationResult} = await import('./publickey.js');
    const cred = createMockCredential('cred-orphaned');
    mockPost.mockRejectedValueOnce({
      status: 400,
      error: 'User verification failed.',
    });

    await expect(
      verifyPublicKeyCreationResult(cred, 'rp.localhost', true)
    ).rejects.toThrow('User verification failed.');

    expect(mockPost).toHaveBeenCalledWith(
      '/webauthn/registerResponse?conditional',
      cred.toJSON()
    );
    expect(mockSignalUnknownCredential).toHaveBeenCalledOnce();
    expect(mockSignalUnknownCredential).toHaveBeenCalledWith({
      rpId: 'rp.localhost',
      credentialId: 'cred-orphaned',
    });
  });

  it('skips signalUnknownCredential when registration fails with 409 Conflict', async () => {
    const {verifyPublicKeyCreationResult} = await import('./publickey.js');
    const cred = createMockCredential('cred-existing-live');
    mockPost.mockRejectedValueOnce({
      status: 409,
      error: 'Credential ID is already registered.',
    });

    await expect(
      verifyPublicKeyCreationResult(cred, 'rp.localhost', false)
    ).rejects.toThrow('Credential ID is already registered.');

    expect(mockSignalUnknownCredential).not.toHaveBeenCalled();
  });

  it('preserves the original registration error when signalUnknownCredential rejects', async () => {
    const {verifyPublicKeyCreationResult} = await import('./publickey.js');
    const cred = createMockCredential('cred-signal-err');
    mockPost.mockRejectedValueOnce({
      status: 400,
      error: 'Invalid challenge',
    });
    mockSignalUnknownCredential.mockRejectedValueOnce(
      new Error('Signal API failure')
    );

    await expect(
      verifyPublicKeyCreationResult(cred, 'rp.localhost', false)
    ).rejects.toThrow('Invalid challenge');

    expect(mockSignalUnknownCredential).toHaveBeenCalledOnce();
  });
});
