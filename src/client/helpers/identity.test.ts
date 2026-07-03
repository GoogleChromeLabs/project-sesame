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
import {SesameIdP} from './identity.js';
import {post, $} from '~project-sesame/client/helpers/index';

// Mock the helpers
vi.mock('~project-sesame/client/helpers/index', () => ({
  post: vi.fn(),
  $: vi.fn(),
}));

describe('SesameIdP', () => {
  const mockGet = vi.fn();
  const mockPreventSilentAccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock navigator.credentials
    vi.stubGlobal('navigator', {
      credentials: {
        get: mockGet,
        preventSilentAccess: mockPreventSilentAccess,
      },
    });

    // Mock window and document
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    vi.stubGlobal('document', {
      querySelector: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should initialize with URLs', () => {
      const idp = new SesameIdP([
        'https://idp.example.com',
        'https://idp2.example.com/path',
      ]);
      expect(idp.urls).toEqual([
        'https://idp.example.com/',
        'https://idp2.example.com/path',
      ]);
    });

    it('should handle empty URLs', () => {
      const idp = new SesameIdP([]);
      expect(idp.urls).toEqual([]);
    });
  });

  describe('initialize', () => {
    it('should initialize and populate idps', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);

      vi.mocked(post).mockResolvedValueOnce({
        idps: [
          {
            configURL: 'https://idp.example.com/fedcm.json',
            clientId: 'client123',
          },
        ],
      });

      await idp.initialize();

      expect(post).toHaveBeenCalledWith('/federation/options', {
        urls: ['https://idp.example.com/'],
      });
      expect(idp.idps).toEqual([
        {
          origin: 'https://idp.example.com',
          configURL: 'https://idp.example.com/fedcm.json',
          clientId: 'client123',
        },
      ]);
    });

    it('should throw error during initialize if configURL is missing', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);

      vi.mocked(post).mockResolvedValueOnce({
        idps: [
          {
            configURL: '',
            clientId: 'client123',
          },
        ],
      });

      await expect(idp.initialize()).rejects.toThrow(
        'configURL or client ID is not declared.'
      );
    });

    it('should throw error during initialize if clientId is missing', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);

      vi.mocked(post).mockResolvedValueOnce({
        idps: [
          {
            configURL: 'https://idp.example.com/fedcm.json',
            clientId: '',
          },
        ],
      });

      await expect(idp.initialize()).rejects.toThrow(
        'configURL or client ID is not declared.'
      );
    });
  });

  describe('signIn', () => {
    it('should perform signIn successfully', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      idp.idps = [
        {
          origin: 'https://idp.example.com',
          configURL: 'https://idp.example.com/fedcm.json',
          clientId: 'client123',
        },
      ];

      vi.mocked($).mockReturnValue({content: 'mock-nonce'} as any);

      const mockCredential = {
        configURL: 'https://idp.example.com/fedcm.json',
        token: 'mock-token',
      };
      mockGet.mockResolvedValueOnce(mockCredential);

      const mockUser = {id: 'user123', username: 'testuser'};
      vi.mocked(post).mockResolvedValueOnce(mockUser);

      const result = await idp.signIn({
        mode: 'active',
        loginHint: 'hint',
        context: 'signin',
        mediation: 'optional',
      });

      expect($).toHaveBeenCalledWith('meta[name="nonce"]');
      expect(mockGet).toHaveBeenCalledWith({
        identity: {
          providers: [
            {
              configURL: 'https://idp.example.com/fedcm.json',
              clientId: 'client123',
              loginHint: 'hint',
              fields: undefined,
              params: {nonce: 'mock-nonce'},
            },
          ],
          mode: 'active',
          context: 'signin',
        },
        mediation: 'optional',
      });
      expect(post).toHaveBeenCalledWith('/federation/verifyIdToken', {
        token: 'mock-token',
        url: 'https://idp.example.com',
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error if nonce is missing', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      vi.mocked($).mockReturnValue(null);

      await expect(idp.signIn()).rejects.toThrow('nonce is not declared.');
    });

    it('should throw error if no verified IdP matches the credential configURL', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      idp.idps = [
        {
          origin: 'https://idp.example.com',
          configURL: 'https://idp.example.com/fedcm.json',
          clientId: 'client123',
        },
      ];

      vi.mocked($).mockReturnValue({content: 'mock-nonce'} as any);

      const mockCredential = {
        configURL: 'https://different.com/fedcm.json',
        token: 'mock-token',
      };
      mockGet.mockResolvedValueOnce(mockCredential);

      await expect(idp.signIn()).rejects.toThrow('No verified IdP found.');
    });

    it('should throw error if backend verification fails', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      idp.idps = [
        {
          origin: 'https://idp.example.com',
          configURL: 'https://idp.example.com/fedcm.json',
          clientId: 'client123',
        },
      ];

      vi.mocked($).mockReturnValue({content: 'mock-nonce'} as any);

      const mockCredential = {
        configURL: 'https://idp.example.com/fedcm.json',
        token: 'mock-token',
      };
      mockGet.mockResolvedValueOnce(mockCredential);

      vi.mocked(post).mockRejectedValueOnce(new Error('Network error'));

      await expect(idp.signIn()).rejects.toThrow(
        'Identity verification failed.'
      );
    });
  });

  describe('delegate', () => {
    it('should perform delegate successfully', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      idp.idps = [
        {
          origin: 'https://idp.example.com',
          configURL: 'https://idp.example.com/fedcm.json',
          clientId: 'client123',
        },
      ];

      vi.mocked($).mockReturnValue({content: 'mock-nonce'} as any);

      const mockCredential = {
        configURL: 'https://idp.example.com/fedcm.json',
        token: 'mock-vc-token',
      };
      mockGet.mockResolvedValueOnce(mockCredential);

      const mockUser = {id: 'user123', username: 'testuser'};
      vi.mocked(post).mockResolvedValueOnce(mockUser);

      const result = await idp.delegate({
        fields: ['name', 'email'],
      });

      expect(mockGet).toHaveBeenCalledWith({
        identity: {
          providers: [
            {
              format: 'vc+sd-jwt',
              configURL: 'https://idp.example.com/fedcm.json',
              clientId: 'client123',
              fields: ['name', 'email'],
              params: {nonce: 'mock-nonce'},
            },
          ],
        },
        mediation: undefined,
      });
      expect(post).toHaveBeenCalledWith('/federation/verifySdJwt', {
        token: 'mock-vc-token',
        url: 'https://idp.example.com',
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error if nonce is missing in delegate', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      vi.mocked($).mockReturnValue(null);

      await expect(idp.delegate()).rejects.toThrow('nonce is not declared.');
    });

    it('should throw error if no verified IdP matches in delegate', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      idp.idps = [
        {
          origin: 'https://idp.example.com',
          configURL: 'https://idp.example.com/fedcm.json',
          clientId: 'client123',
        },
      ];

      vi.mocked($).mockReturnValue({content: 'mock-nonce'} as any);

      const mockCredential = {
        configURL: 'https://different.com/fedcm.json',
        token: 'mock-token',
      };
      mockGet.mockResolvedValueOnce(mockCredential);

      await expect(idp.delegate()).rejects.toThrow('No verified IdP found.');
    });
  });

  describe('iframe', () => {
    it('should resolve iframe promise when receiving valid message', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      idp.idps = [
        {
          origin: 'https://idp.example.com',
          configURL: 'https://idp.example.com/fedcm.json',
          clientId: 'client123',
        },
      ];

      vi.mocked($).mockReturnValue({content: 'mock-nonce'} as any);

      let messageCallback: ((event: any) => void) | undefined;
      global.window.addEventListener = vi
        .fn()
        .mockImplementation((event, callback) => {
          if (event === 'message') {
            messageCallback = callback;
          }
        });

      vi.mocked(post).mockResolvedValueOnce(true);

      const iframePromise = idp.iframe();

      expect(global.window.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );

      if (messageCallback) {
        const mockEvent = {
          origin: 'https://idp.example.com',
          data: {token: 'iframe-token'},
          stopPropagation: vi.fn(),
        };
        await messageCallback(mockEvent);
      }

      await expect(iframePromise).resolves.toBeUndefined();
      expect(post).toHaveBeenCalledWith('/federation/verifyIdToken', {
        token: 'iframe-token',
        url: 'https://idp.example.com',
      });
      expect(global.window.removeEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should throw error if nonce is missing in iframe', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      vi.mocked($).mockReturnValue(null);

      const iframePromise = idp.iframe();
      await expect(iframePromise).rejects.toThrow('nonce is not declared.');
    });

    it('should throw error if no IdP specified in iframe', async () => {
      const idp = new SesameIdP(); // No URLs, no idps
      vi.mocked($).mockReturnValue({content: 'mock-nonce'} as any);

      const iframePromise = idp.iframe();
      await expect(iframePromise).rejects.toThrow('IdP not specified.');
    });

    it('should reject iframe promise when token verification fails', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      idp.idps = [
        {
          origin: 'https://idp.example.com',
          configURL: 'https://idp.example.com/fedcm.json',
          clientId: 'client123',
        },
      ];

      vi.mocked($).mockReturnValue({content: 'mock-nonce'} as any);

      let messageCallback: ((event: any) => void) | undefined;
      global.window.addEventListener = vi
        .fn()
        .mockImplementation((event, callback) => {
          if (event === 'message') {
            messageCallback = callback;
          }
        });

      vi.mocked(post).mockResolvedValueOnce(false); // verification returns falsy

      const iframePromise = idp.iframe();

      if (messageCallback) {
        const mockEvent = {
          origin: 'https://idp.example.com',
          data: {token: 'iframe-token'},
          stopPropagation: vi.fn(),
        };
        await messageCallback(mockEvent);
      }

      await expect(iframePromise).rejects.toThrow('Token verification failed.');
      expect(global.window.removeEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should reject iframe promise when post throws an error', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      idp.idps = [
        {
          origin: 'https://idp.example.com',
          configURL: 'https://idp.example.com/fedcm.json',
          clientId: 'client123',
        },
      ];

      vi.mocked($).mockReturnValue({content: 'mock-nonce'} as any);

      let messageCallback: ((event: any) => void) | undefined;
      global.window.addEventListener = vi
        .fn()
        .mockImplementation((event, callback) => {
          if (event === 'message') {
            messageCallback = callback;
          }
        });

      vi.mocked(post).mockRejectedValueOnce({error: 'Server Error'});

      const iframePromise = idp.iframe();

      if (messageCallback) {
        const mockEvent = {
          origin: 'https://idp.example.com',
          data: {token: 'iframe-token'},
          stopPropagation: vi.fn(),
        };
        await messageCallback(mockEvent);
      }

      await expect(iframePromise).rejects.toThrow('Server Error');
      expect(global.window.removeEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should ignore messages from different origins', async () => {
      const idp = new SesameIdP(['https://idp.example.com']);
      idp.idps = [
        {
          origin: 'https://idp.example.com',
          configURL: 'https://idp.example.com/fedcm.json',
          clientId: 'client123',
        },
      ];

      vi.mocked($).mockReturnValue({content: 'mock-nonce'} as any);

      let messageCallback: ((event: any) => void) | undefined;
      global.window.addEventListener = vi
        .fn()
        .mockImplementation((event, callback) => {
          if (event === 'message') {
            messageCallback = callback;
          }
        });

      const iframePromise = idp.iframe();

      if (messageCallback) {
        const mockEvent = {
          origin: 'https://attacker.com',
          data: {token: 'attacker-token'},
          stopPropagation: vi.fn(),
        };
        await messageCallback(mockEvent);
      }

      // The promise should still be pending because the message was ignored.
      // We can verify that post was not called.
      expect(post).not.toHaveBeenCalled();

      // Resolve the promise to clean up and avoid lint error
      vi.mocked(post).mockResolvedValueOnce(true);
      if (messageCallback) {
        const mockEvent = {
          origin: 'https://idp.example.com',
          data: {token: 'iframe-token'},
          stopPropagation: vi.fn(),
        };
        await messageCallback(mockEvent);
      }
      await iframePromise;
    });
  });

  describe('signOut', () => {
    it('should call preventSilentAccess on signOut', async () => {
      const idp = new SesameIdP();
      await idp.signOut();
      expect(mockPreventSilentAccess).toHaveBeenCalled();
    });

    it('should not throw if preventSilentAccess is not supported', async () => {
      // @ts-ignore
      delete global.navigator.credentials.preventSilentAccess;
      const idp = new SesameIdP();
      await expect(idp.signOut()).resolves.toBeUndefined();
    });
  });
});
