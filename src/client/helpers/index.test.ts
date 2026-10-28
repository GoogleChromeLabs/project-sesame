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

vi.mock('mdui/components/linear-progress', () => ({
  LinearProgress: class {},
}));
vi.mock('mdui/components/button-icon', () => ({
  ButtonIcon: class {},
}));
vi.mock('mdui/components/text-field', () => ({
  TextField: class {},
}));
vi.mock('mdui/components/navigation-drawer', () => ({
  NavigationDrawer: class {},
}));

describe('postForm', () => {
  const mockCreate = vi.fn();
  const mockStore = vi.fn();
  const mockFetch = vi.fn();
  let mockFormElement: {
    action: string;
    addEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockFormElement = {
      action: 'https://rp.localhost/auth/username-password',
      addEventListener: vi.fn(),
    };

    class MockHTMLDialogElement {}
    Object.defineProperty(MockHTMLDialogElement.prototype, 'closedBy', {
      value: 'any',
      configurable: true,
    });
    vi.stubGlobal('HTMLDialogElement', MockHTMLDialogElement);

    vi.stubGlobal('document', {
      querySelector: vi.fn((selector: string) => {
        if (selector === '#form') {
          return mockFormElement;
        }
        if (selector === '#dialog') {
          return new MockHTMLDialogElement();
        }
        return null;
      }),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
    });

    vi.stubGlobal('window', {
      PasswordCredential: class {},
    });

    vi.stubGlobal('navigator', {
      credentials: {
        create: mockCreate,
        store: mockStore,
      },
    });

    vi.stubGlobal('fetch', mockFetch);

    class MockFormData {
      private entries: Map<string, string>;
      constructor(target: {entries?: Record<string, string>}) {
        this.entries = new Map(Object.entries(target?.entries || {}));
      }
      forEach(cb: (value: string, key: string) => void) {
        this.entries.forEach((v, k) => cb(v, k));
      }
      get(key: string): string | null {
        return this.entries.get(key) ?? null;
      }
    }
    vi.stubGlobal('FormData', MockFormData);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates and stores a PasswordCredential when username and password are submitted', async () => {
    const {postForm} = await import('./index.js');

    const callback = vi.fn();
    const errorCallback = vi.fn();
    postForm(callback, errorCallback);

    expect(mockFormElement.addEventListener).toHaveBeenCalledWith(
      'submit',
      expect.any(Function)
    );

    const submitHandler = mockFormElement.addEventListener.mock.calls[0][1];
    const mockCred = {id: 'alice', type: 'password'};
    mockCreate.mockResolvedValueOnce(mockCred);
    mockStore.mockResolvedValueOnce(mockCred);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({status: 'ok'}),
    });

    await submitHandler({
      preventDefault: vi.fn(),
      target: {
        action: '/auth/username-password',
        entries: {username: 'alice', password: 'secret-password'},
      },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      password: {id: 'alice', password: 'secret-password'},
    });
    expect(mockStore).toHaveBeenCalledWith(mockCred);
    expect(callback).toHaveBeenCalledWith({status: 'ok'});
    expect(errorCallback).not.toHaveBeenCalled();
  });

  it('does not call navigator.credentials.store when create returns null', async () => {
    const {postForm} = await import('./index.js');

    const callback = vi.fn();
    const errorCallback = vi.fn();
    postForm(callback, errorCallback);

    const submitHandler = mockFormElement.addEventListener.mock.calls[0][1];
    mockCreate.mockResolvedValueOnce(null);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({status: 'ok'}),
    });

    await submitHandler({
      preventDefault: vi.fn(),
      target: {
        action: '/auth/username-password',
        entries: {username: 'alice', password: 'secret-password'},
      },
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockStore).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({status: 'ok'});
  });

  it('skips PasswordCredential creation when password field is not present', async () => {
    const {postForm} = await import('./index.js');

    const callback = vi.fn();
    const errorCallback = vi.fn();
    postForm(callback, errorCallback);

    const submitHandler = mockFormElement.addEventListener.mock.calls[0][1];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({status: 'ok'}),
    });

    await submitHandler({
      preventDefault: vi.fn(),
      target: {
        action: '/auth/username',
        entries: {username: 'alice'},
      },
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockStore).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({status: 'ok'});
  });

  it('calls errorCallback and prevents submission when local validator returns an error string', async () => {
    const {postForm} = await import('./index.js');

    const callback = vi.fn();
    const errorCallback = vi.fn();
    const validate = vi.fn().mockReturnValue('Passwords do not match.');

    postForm(callback, errorCallback, validate);

    const submitHandler = mockFormElement.addEventListener.mock.calls[0][1];

    await submitHandler({
      preventDefault: vi.fn(),
      target: {
        action: '/auth/new-username-password',
        entries: {username: 'alice', password1: 'p1', password2: 'p2'},
      },
    });

    expect(validate).toHaveBeenCalled();
    expect(errorCallback).toHaveBeenCalledWith(
      new Error('Passwords do not match.')
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });
});
