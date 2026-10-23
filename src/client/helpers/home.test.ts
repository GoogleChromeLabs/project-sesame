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
const mockLoadingStart = vi.fn();
const mockLoadingStop = vi.fn();
const mockRender = vi.fn();

vi.mock('lit', () => ({
  html: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
  render: (...args: unknown[]) => mockRender(...args),
}));

vi.mock('~project-sesame/client/helpers/index', () => ({
  $: vi.fn(() => ({})),
  post: (...args: unknown[]) => mockPost(...args),
  loading: {
    start: (...args: unknown[]) => mockLoadingStart(...args),
    stop: (...args: unknown[]) => mockLoadingStop(...args),
  },
}));

vi.mock('~project-sesame/client/layout', () => ({}));

describe('home page - changeDisplayName', () => {
  const mockSignalCurrentUserDetails = vi.fn();
  const mockPrompt = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    const MockPublicKeyCredential = {
      signalCurrentUserDetails: mockSignalCurrentUserDetails,
    };

    vi.stubGlobal('PublicKeyCredential', MockPublicKeyCredential);
    vi.stubGlobal('window', {
      PublicKeyCredential: MockPublicKeyCredential,
    });
    vi.stubGlobal('prompt', mockPrompt);

    // Default response for initial renderDisplayName() on module import
    mockPost.mockResolvedValue({
      username: 'alice',
      displayName: 'Alice',
      picture: 'https://example.com/alice.png',
      passkeyUserId: 'passkey-user-123',
      rpId: 'rp.localhost',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updates display name and calls PublicKeyCredential.signalCurrentUserDetails()', async () => {
    const {changeDisplayName} =
      await import('~project-sesame/client/pages/home.js');
    vi.clearAllMocks();

    mockPrompt.mockReturnValueOnce('Alice Updated');
    mockPost
      .mockResolvedValueOnce({
        username: 'alice',
        displayName: 'Alice Updated',
        picture: 'https://example.com/alice.png',
        passkeyUserId: 'passkey-user-123',
        rpId: 'rp.localhost',
      })
      .mockResolvedValueOnce({
        username: 'alice',
        displayName: 'Alice Updated',
        picture: 'https://example.com/alice.png',
        passkeyUserId: 'passkey-user-123',
        rpId: 'rp.localhost',
      });
    mockSignalCurrentUserDetails.mockResolvedValueOnce(undefined);

    await changeDisplayName({
      target: {dataset: {displayName: 'Alice'}} as unknown as HTMLButtonElement,
    });

    expect(mockPost).toHaveBeenNthCalledWith(1, '/auth/updateDisplayName', {
      newName: 'Alice Updated',
    });
    expect(mockSignalCurrentUserDetails).toHaveBeenCalledWith({
      rpId: 'rp.localhost',
      userId: 'passkey-user-123',
      name: 'alice',
      displayName: 'Alice Updated',
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/auth/userinfo');
    expect(mockLoadingStop).toHaveBeenCalled();
  });

  it('does not update or signal when prompt is cancelled or empty', async () => {
    const {changeDisplayName} =
      await import('~project-sesame/client/pages/home.js');
    vi.clearAllMocks();

    mockPrompt.mockReturnValueOnce(null);

    await changeDisplayName({
      target: {dataset: {displayName: 'Alice'}} as unknown as HTMLButtonElement,
    });

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockSignalCurrentUserDetails).not.toHaveBeenCalled();
  });

  it('continues rendering even if signalCurrentUserDetails rejects', async () => {
    const {changeDisplayName} =
      await import('~project-sesame/client/pages/home.js');
    vi.clearAllMocks();

    mockPrompt.mockReturnValueOnce('Alice Updated');
    mockPost
      .mockResolvedValueOnce({
        username: 'alice',
        displayName: 'Alice Updated',
        picture: 'https://example.com/alice.png',
        passkeyUserId: 'passkey-user-123',
        rpId: 'rp.localhost',
      })
      .mockResolvedValueOnce({
        username: 'alice',
        displayName: 'Alice Updated',
        picture: 'https://example.com/alice.png',
        passkeyUserId: 'passkey-user-123',
        rpId: 'rp.localhost',
      });
    mockSignalCurrentUserDetails.mockRejectedValueOnce(
      new Error('Signal failed')
    );

    await changeDisplayName({
      target: {dataset: {displayName: 'Alice'}} as unknown as HTMLButtonElement,
    });

    expect(mockSignalCurrentUserDetails).toHaveBeenCalledOnce();
    expect(mockLoadingStop).toHaveBeenCalled();
    expect(mockPost).toHaveBeenNthCalledWith(2, '/auth/userinfo');
  });
});
