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

import {MdLinearProgress} from '@material/web/progress/linear-progress';
import {MdIconButton} from '@material/web/iconbutton/icon-button';
import {Drawer} from '@material/mwc-drawer';

export const $: any = document.querySelector.bind(document);

export const redirect = (path: string = '') => {
  if (path !== '') {
    location.href = path;
  }
};

export function toast(text: string): void {
  $('#snackbar').labelText = text;
  $('#snackbar').show();
}

/**
 * Sends a POST request with payload. Throws when the response is not 200.
 * @param path The endpoint path.
 * @param payload The payload JSON object.
 * @returns
 */
export async function _fetch(path: string, payload: any = ''): Promise<any> {
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
  progress: MdLinearProgress;

  constructor() {
    this.progress = $('#progress');
  }

  start() {
    this.progress.indeterminate = true;
    const inputs = document.querySelectorAll('md-outlined-text-field');
    if (inputs) {
      inputs.forEach(input => (input.disabled = true));
    }
  }

  stop() {
    this.progress.indeterminate = false;
    const inputs = document.querySelectorAll('md-outlined-text-field');
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
      const cred = {} as any;
      form.forEach((v, k) => (cred[k] = v));
      loading.start();
      _fetch(s.target.action, cred)
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
  if (e.target instanceof MdIconButton &&
      e.target.parentNode instanceof HTMLInputElement) {
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

document.addEventListener('DOMContentLoaded', e => {
  const drawer: Drawer | null = document.querySelector('mwc-drawer');
  drawer?.addEventListener(
    'MDCTopAppBar:nav',
    () => (drawer.open = !drawer.open)
  );
  const signout = $('#signout');
  if (signout) {
    signout.addEventListener('click', signOut);
  }
  const toggle = $('#password-toggle');
  if (toggle) {
    toggle.addEventListener('click', togglePasswordVisibility);
  }
});
