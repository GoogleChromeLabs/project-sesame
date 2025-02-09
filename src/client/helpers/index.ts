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
import { ButtonIcon } from 'mdui/components/button-icon';
import { TextField } from 'mdui/components/text-field';
import { NavigationDrawer } from 'mdui/components/navigation-drawer';

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
  try {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: headers,
      body: payload,
    });
    if (res.status === 200) {
      // Server authentication succeeded
      return res.json();
    } else {
      // Server authentication failed
      const result = await res.json();
      throw new Error(result.error); 
    }
  } catch (error) {
    throw error;
  }
}

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
      post(s.target.action, cred)
        .then(results => {
          resolve(results);
        })
        .catch(e => {
          loading.stop();
          console.error(e.message);
          reject(e);
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
    bar.style.display = 'block';
    drawer.open = false;
  } else {
    // Desktop display
    bar.style.display = 'none';
    drawer.open = true;
  }
};

// Initialization
document.addEventListener('DOMContentLoaded', e => {
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

  const mediaQuery = window.matchMedia('(max-width: 768px)');
  mediaQuery.addEventListener('change', changeLayout);

  // Initialize
  changeLayout(mediaQuery);
});
