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
const mockRedirect = vi.fn();
const mockToast = vi.fn();

class MockClassList {
  private classes: Set<string>;

  constructor(initial: string[] = []) {
    this.classes = new Set(initial);
  }

  add(...tokens: string[]): void {
    tokens.forEach(token => this.classes.add(token));
  }

  remove(...tokens: string[]): void {
    tokens.forEach(token => this.classes.delete(token));
  }

  toggle(token: string, force?: boolean): boolean {
    if (force === undefined) {
      if (this.classes.has(token)) {
        this.classes.delete(token);
        return false;
      }
      this.classes.add(token);
      return true;
    }
    if (force) {
      this.classes.add(token);
      return true;
    }
    this.classes.delete(token);
    return false;
  }

  contains(token: string): boolean {
    return this.classes.has(token);
  }
}

interface MockElement {
  value: string;
  textContent: string;
  disabled: boolean;
  classList: MockClassList;
  attributes: Map<string, string>;
  listeners: Map<string, (event: {preventDefault: () => void}) => unknown>;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (
    type: string,
    handler: (event: {preventDefault: () => void}) => unknown
  ) => void;
  reportValidity: () => boolean;
}

function createMockElement(initialClasses: string[] = []): MockElement {
  const attributes = new Map<string, string>();
  const listeners = new Map<
    string,
    (event: {preventDefault: () => void}) => unknown
  >();
  return {
    value: '',
    textContent: '',
    disabled: false,
    classList: new MockClassList(initialClasses),
    attributes,
    listeners,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => {
      attributes.set(name, value);
    },
    addEventListener: (type, handler) => {
      listeners.set(type, handler);
    },
    reportValidity: vi.fn(() => true),
  };
}

let elements: Record<string, MockElement>;

vi.mock('~project-sesame/client/helpers/index', () => ({
  $: vi.fn((selector: string) => elements[selector]),
  post: (...args: unknown[]) => mockPost(...args),
  redirect: (...args: unknown[]) => mockRedirect(...args),
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock('~project-sesame/client/layout', () => ({}));

describe('evp page', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    elements = {
      '#email-form-container': createMockElement(),
      '#evp-form': createMockElement(),
      '#email': createMockElement(),
      '#evt': createMockElement(),
      '#submit-btn': createMockElement(),
      '#otp-fallback-container': createMockElement(['hidden']),
      '#fallback-email-display': createMockElement(),
      '#otp-form': createMockElement(),
      '#otp': createMockElement(),
      '#otp-cancel-btn': createMockElement(),
      '#success-container': createMockElement(['hidden']),
      '#verified-email-text': createMockElement(),
      '#verified-method-evp': createMockElement(),
      '#verified-method-otp': createMockElement(['hidden']),
      '#back-btn': createMockElement(),
    };
    elements['#evt'].setAttribute('data-nonce', 'test-nonce-123');

    const addEventListener = vi.fn();
    vi.stubGlobal('document', {
      addEventListener,
    });

    await import('../pages/evp.js');
    const domLoadedCall = addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'DOMContentLoaded'
    );
    const domLoadedHandler = domLoadedCall?.[1] as (() => void) | undefined;
    domLoadedHandler?.();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('binds data-nonce to nonce attribute and shows EVP copy on EVP verification success', async () => {
    expect(elements['#evt'].getAttribute('nonce')).toBe('test-nonce-123');

    elements['#email'].value = 'demo@rowan.fyi';
    elements['#evt'].value = 'signed.evt.token~kb.jwt';
    mockPost.mockResolvedValueOnce({
      success: true,
      verifiedEmail: 'demo@rowan.fyi',
      steps: {},
    });

    const submitHandler = elements['#evp-form'].listeners.get('submit');
    await submitHandler?.({preventDefault: vi.fn()});

    expect(mockPost).toHaveBeenCalledWith('/email/verify', {
      email: 'demo@rowan.fyi',
      evt: 'signed.evt.token~kb.jwt',
    });
    expect(elements['#email-form-container'].classList.contains('hidden')).toBe(
      true
    );
    expect(elements['#success-container'].classList.contains('hidden')).toBe(
      false
    );
    expect(elements['#verified-email-text'].textContent).toBe('demo@rowan.fyi');
    expect(elements['#verified-method-evp'].classList.contains('hidden')).toBe(
      false
    );
    expect(elements['#verified-method-otp'].classList.contains('hidden')).toBe(
      true
    );
  });

  it('falls back to OTP when no EVT is present and shows OTP fallback copy on valid 6-digit code', async () => {
    elements['#email'].value = 'user@example.com';
    elements['#evt'].value = '';

    const evpSubmitHandler = elements['#evp-form'].listeners.get('submit');
    await evpSubmitHandler?.({preventDefault: vi.fn()});

    expect(elements['#email-form-container'].classList.contains('hidden')).toBe(
      true
    );
    expect(
      elements['#otp-fallback-container'].classList.contains('hidden')
    ).toBe(false);
    expect(elements['#fallback-email-display'].textContent).toBe(
      'user@example.com'
    );

    elements['#otp'].value = '123456';
    const otpSubmitHandler = elements['#otp-form'].listeners.get('submit');
    otpSubmitHandler?.({preventDefault: vi.fn()});

    expect(
      elements['#otp-fallback-container'].classList.contains('hidden')
    ).toBe(true);
    expect(elements['#success-container'].classList.contains('hidden')).toBe(
      false
    );
    expect(elements['#verified-email-text'].textContent).toBe(
      'user@example.com'
    );
    expect(elements['#verified-method-evp'].classList.contains('hidden')).toBe(
      true
    );
    expect(elements['#verified-method-otp'].classList.contains('hidden')).toBe(
      false
    );
    expect(mockToast).toHaveBeenCalledWith(
      'Email verified via OTP: user@example.com'
    );
  });

  it('rejects invalid OTP codes without displaying the success screen', () => {
    elements['#email'].value = 'user@example.com';
    elements['#otp'].value = '12345';

    const otpSubmitHandler = elements['#otp-form'].listeners.get('submit');
    otpSubmitHandler?.({preventDefault: vi.fn()});

    expect(elements['#success-container'].classList.contains('hidden')).toBe(
      true
    );
    expect(mockToast).toHaveBeenCalledWith(
      'Invalid OTP format. Must be 6 digits.'
    );
  });
});
