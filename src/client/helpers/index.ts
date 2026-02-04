/*
 * @license
 * Copyright 2023 Google Inc. All rights reserved.
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

import {LinearProgress} from 'mdui/components/linear-progress';
import {Dialog} from 'mdui/components/dialog';
import {ButtonIcon} from 'mdui/components/button-icon';
import {TextField} from 'mdui/components/text-field';
import {NavigationDrawer} from 'mdui/components/navigation-drawer';
import {marked} from 'marked';

export const $: any = document.querySelector.bind(document);

/**
 * Safely redirects the user to a new path within the same origin.
 *
 * If the provided path is an absolute URL to a different origin, or an
 * invalid path, it logs a warning/error and redirects to the root path ('/')
 * as a security measure to prevent open redirect vulnerabilities.
 *
 * @param path The destination path or URL. If relative, it's resolved against
 *             the current origin. If absolute, its origin must match the
 *             current location's origin. Defaults to an empty string, which
 *             results in no action.
 */
export const redirect = async (
  path: string,
  timeout?: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (path === '') {
      // By returning here, you prevent the rest of the function from running.
      return reject(new Error('Redirect path cannot be empty.'));
    }

    try {
      // Resolve the path against the current location's origin.
      // This handles:
      // 1. Absolute URLs: new URL("https://example.com/path") -> origin is "https://example.com"
      // 2. Relative paths: new URL("/path", "https://current.com") -> origin is "https://current.com"
      // 3. Protocol-relative URLs: new URL("//other.com/path", "https://current.com") -> origin is "https://other.com" (will be caught)
      const targetUrl = new URL(path, location.origin);

      // Check if the origin of the target URL is the same as the current location's origin.
      if (targetUrl.origin === location.origin) {
        if (timeout && timeout > 0) {
          setTimeout(() => {
            location.href = targetUrl.toString();
            return resolve();
          }, timeout);
        } else {
          location.href = targetUrl.toString();
          return resolve();
        }
      } else {
        // The path is an external URL or a protocol-relative URL to a different domain.
        console.warn(
          `Attempted to redirect to an external URL: ${path}. Redirecting to '/' instead.`
        );
        location.href = '/'; // Default safe redirect
        return resolve();
      }
    } catch (error) {
      // This might happen if 'path' is not a valid URL or path segment.
      console.error(
        `Invalid path for redirect: ${path}. Error: ${error}. Redirecting to '/' instead.`
      );
      location.href = '/'; // Default safe redirect
      return reject();
    }
  });
};

/**
 * Updates the href of a specified anchor element to include a redirect parameter ('r')
 * from the current page's URL.
 *
 * This function is useful for ensuring that alternative sign-in or navigation links
 * persist the original redirect destination if one was provided in the URL.
 *
 * It looks for an 'r' query parameter in the current `location.href`. If found,
 * and if an element matching the provided CSS `query` selector exists (and has an `href`),
 * the function will append or update the 'r' parameter on the element's `href`.
 *
 * Console messages are logged for debugging purposes, indicating success,
 * failure to update the href, or if the target element was not found.
 *
 * @param domQuery A CSS selector string used to find the target anchor element
 *              whose href needs to be updated.
 */
export const setRedirect = (domQuery: string): string => {
  // Get redirect parameter 'r'
  const currentUrl = new URL(location.href);
  const r = currentUrl.searchParams.get('r');

  // Update the alternative sign-in link
  const alternativeLink = $(domQuery);

  if (alternativeLink && r) {
    try {
      // Construct the target URL, preserving existing params if any
      const targetUrl = new URL(alternativeLink.href, location.origin); // Use base URL for relative links
      targetUrl.searchParams.set('r', r); // Add or update the 'r' parameter
      alternativeLink.href = targetUrl.toString(); // Set the updated href
      console.log(`Updated alternative link href to: ${alternativeLink.href}`);

      return new URL(r, location.origin).pathname;
    } catch (error) {
      console.error("Failed to update alternative sign-in link's href:", error);
      // Avoid breaking the page if URL parsing fails
    }
  } else if (!alternativeLink) {
    console.warn(
      'Could not find the alternative sign-in link element to update its href.'
    );
  }
  return '';
};

export function toast(text: string): void {
  $('#snackbar').innerText = text;
  $('#snackbar').open = true;
}

/**
 * Sends a GET request with query. Throws when the response is not 200.
 * @param path The endpoint path.
 * @param payload The payload JSON object.
 * @returns
 */
export async function get(path: string, payload: object = {}): Promise<any> {
  const headers: {[key: string]: string} = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  const url = new URL(path, location.origin);

  for (const key in payload) {
    if (payload.hasOwnProperty(key)) {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(payload[key]);

      url.searchParams.append(encodedKey, encodedValue);
    }
  }

  const res = await fetch(url.toString(), {
    credentials: 'same-origin',
    headers,
  });

  if (res.ok) {
    // Server authentication succeeded
    return res.json();
  } else {
    // Server authentication failed
    const result = await res.json();
    result.status = res.status;
    throw result;
  }
}

/**
 * Sends a POST request with payload. Throws when the response is not 200.
 * @param path The endpoint path.
 * @param payload The payload JSON object.
 * @returns
 */
export async function post(
  path: string,
  payload: string | object | FormData = ''
): Promise<any> {
  const headers: {[key: string]: string} = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (payload && !(payload instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(payload);
  }

  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: payload,
  });

  if (res.ok) {
    // Server authentication succeeded
    return res.json();
  } else {
    // Server authentication failed
    const result = await res.json();
    result.status = res.status;
    throw result;
  }
}

/**
 * Dialog controller
 */
export class SesameDialog {
  dialog: Dialog;

  constructor() {
    this.dialog = $('#dialog');
  }

  set(headline: string, description = ''): void {
    const headlineElement = $('#dialog span[slot="headline"]');
    if (headlineElement) headlineElement.innerText = headline;

    const descriptionElement = $('#dialog span[slot="description"]');
    if (descriptionElement) descriptionElement.innerHTML = description;
  }

  show(): void {
    this.dialog.open = true;
  }

  close(): void {
    this.dialog.open = false;
  }
}

export const dialog = new SesameDialog();

/**
 * Indicate loading status using a material progress web component.
 */
export class Loading {
  progress: LinearProgress;

  constructor() {
    this.progress = $('#progress');
  }

  start() {
    delete this.progress.value;
    const inputs = document.querySelectorAll('mdui-text-field');
    if (inputs) {
      inputs.forEach(input => (input.disabled = true));
    }
  }

  stop() {
    this.progress.value = 0;
    const inputs = document.querySelectorAll('mdui-text-field');
    if (inputs) {
      inputs.forEach(input => (input.disabled = false));
    }
  }
}

export const loading = new Loading();

export function postForm(callback: Function, errorCallback: Function): void {
  const form = $('#form');
  // When the form is submitted, proceed to the password form.
  form.addEventListener('submit', async (s: SubmitEvent) => {
    s.preventDefault();
    const form = new FormData(<HTMLFormElement>s.target);

    // If `PasswordCredential` is supported, store it to the password manager.
    // @ts-ignore
    if (window.PasswordCredential) {
      // @ts-ignore
      const id = form.get('username');
      const password = form.get('password');
      // Save only if `id` and `password` combination is being submitted.
      if (id && password) {
        await navigator.credentials.create({
          // @ts-ignore
          password: {id, password},
        });
        console.log('PasswordCredential stored');
      }
    }

    const cred = {} as {[key: string]: FormDataEntryValue};
    form.forEach((v, k) => (cred[k] = v));
    loading.start();
    try {
      const results = await post((<HTMLFormElement>s.target).action, cred);
      callback(results);
    } catch (e: any) {
      loading.stop();
      console.error(e.error);
      errorCallback(new Error(e.error));
    }
  });
}

function togglePasswordVisibility(e: MouseEvent) {
  e.preventDefault();
  if (
    e.target instanceof ButtonIcon &&
    e.target.parentNode instanceof TextField
  ) {
    // Toggle password visibility when visibility icon is clicked.
    e.target.parentNode.type = e.target.selected ? 'text' : 'password';
  }
}

async function signOut(e: MouseEvent) {
  e.preventDefault();

  // Prevent auto-sign-in the next time the user comes back.
  await navigator.credentials.preventSilentAccess();

  // Sign out.
  await redirect('/signout');
}

function changeLayout(e: MediaQueryListEvent | MediaQueryList) {
  const drawer = $('mdui-navigation-drawer');
  const bar = $('mdui-top-app-bar');

  if (e.matches) {
    // Mobile display
    bar.style.display = 'flex';
    drawer.open = false;
  } else {
    // Desktop display
    bar.style.display = 'none';
    drawer.open = true;
  }
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  const drawer: NavigationDrawer | null = $('mdui-navigation-drawer');
  if (!drawer) {
    throw new Error('Navigation drawer is not found.');
  }

  // Menu button. Listen when it's found.
  $('#menu-button')?.addEventListener(
    'click',
    () => (drawer.open = !drawer.open)
  );

  // Sign-out button. Listen when it's found.
  $('#signout')?.addEventListener('click', signOut);

  // View password toggle button. Listen when it's found.
  const toggles = document.querySelectorAll<ButtonIcon>('.password-toggle');
  if (toggles.length > 0) {
    toggles.forEach((toggle: ButtonIcon) =>
      toggle.addEventListener('click', togglePasswordVisibility)
    );
  }

  // Show help dialog.
  $('#help')?.addEventListener('click', dialog.show.bind(dialog));

  const mediaQuery = window.matchMedia('(max-width: 768px)');
  mediaQuery.addEventListener('change', changeLayout);

  // Load markdown contents to the dialog
  const description = $('#help-text .help-description')?.innerText?.trim();
  const headline = $('#help-text .help-headline')?.innerText?.trim();
  if (headline && description) {
    const serialized = description
      .split('\n')
      .map((line: string) => line.trim())
      .join('\n');
    const mkDesc = await marked.parse(serialized);
    dialog.set(headline, mkDesc);
  }

  // Initialize
  changeLayout(mediaQuery);
});
