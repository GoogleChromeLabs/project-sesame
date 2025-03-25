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

import { LinearProgress } from 'mdui/components/linear-progress';
import { Dialog } from 'mdui/components/dialog';
import { ButtonIcon } from 'mdui/components/button-icon';
import { TextField } from 'mdui/components/text-field';
import { NavigationDrawer } from 'mdui/components/navigation-drawer';
import { marked } from 'marked';

export const $: any = document.querySelector.bind(document);

export const redirect = (path: string = '') => {
  if (path !== '') {
    location.href = path;
  }
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
export async function get(path: string, payload: any = ''): Promise<any> {
  const headers: any = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  const url = new URL(path);

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
export async function post(path: string, payload: any = ''): Promise<any> {
  const headers: any = {
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
class SesameDialog {
  dialog: Dialog;

  constructor() {
    this.dialog = $('#dialog');
  }

  set(headline: string, description: string = ''): void {
    const headlineElement = $('#dialog span[slot="headline"]');
    if (headlineElement) headlineElement.innerText = headline;

    const descriptionElement = $('#dialog span[slot="description"]');
    if (descriptionElement) descriptionElement.innerHTML = description;
  }

  show(): void {
    this.dialog.open = true;
  }

  close(): void{
    this.dialog.open = false;
  }
}

export const dialog = new SesameDialog();

/**
 * Indicate loading status using a material progress web component.
 */
class Loading {
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

export function postForm(): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = $('#form');
    // When the form is submitted, proceed to the password form.
    form.addEventListener('submit', async (s: any) => {
      s.preventDefault();
      const form = new FormData(s.target);

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
            password: { id, password }
          });
          console.log('PasswordCredential stored');
        }
      }

      const cred = {} as any;
      form.forEach((v, k) => (cred[k] = v));
      loading.start();
      post(s.target.action, cred).then(results => {
        resolve(results);
      }).catch(e => {
        loading.stop();
        console.error(e.message);
        reject(new Error(e.error));
      });
    });
  });
}

function togglePasswordVisibility(e: MouseEvent) {
  e.preventDefault();
  if (e.target instanceof ButtonIcon &&
      e.target.parentNode instanceof TextField) {
    // Toggle password visibility when visibility icon is clicked.
    e.target.parentNode.type = e.target.selected ? 'text' : 'password';
  }
}

async function signOut(e: MouseEvent) {
  e.preventDefault();

  // Prevent auto-sign-in the next time the user comes back.
  await navigator.credentials.preventSilentAccess();

  // Sign out.
  redirect('/signout');
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
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  const drawer: NavigationDrawer | null = $('mdui-navigation-drawer');
  if (!drawer) {
    throw new Error('Navigation drawer is not found.');
  }

  // Menu button. Listen when it's found.
  $('#menu-button')?.addEventListener('click', () => (drawer.open = !drawer.open));

  // Sign-out button. Listen when it's found.
  $('#signout')?.addEventListener('click', signOut);

  // View password toggle button. Listen when it's found.
  $('#password-toggle')?.addEventListener('click', togglePasswordVisibility);

  // Show help dialog.
  $('#help')?.addEventListener('click', dialog.show.bind(dialog));

  const mediaQuery = window.matchMedia('(max-width: 768px)');
  mediaQuery.addEventListener('change', changeLayout);

  // Load markdown contents to the dialog
  const description = $('#help-text .help-description')?.innerText?.trim();
  const headline = $('#help-text .help-headline')?.innerText?.trim();
  if (headline && description) {
    const serialized = description.split('\n').map((line: string) => line.trim()).join('\n');
    const mkDesc = await marked.parse(serialized);
    dialog.set(headline, mkDesc);
  }

  // Initialize
  changeLayout(mediaQuery);
});
