/*
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '~project-sesame/client/layout';
import {$, post, toast} from '~project-sesame/client/helpers/index';

document.addEventListener('DOMContentLoaded', () => {
  const mockLoginForm = $('#mock-login-form') as HTMLFormElement;
  if (mockLoginForm) {
    mockLoginForm.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const email = mockLoginForm.dataset.email || 'demo@chrome.dev';
        const res = await post('/auth/mock-login', {email});
        if (res.username) {
          toast('Logged in successfully!');
          if (navigator.login && navigator.login.setStatus) {
            try {
              await navigator.login.setStatus('logged-in');
              console.info('Set login status to logged-in');
            } catch (err) {
              console.error('Failed to set login status:', err);
            }
          }
          window.location.reload();
        } else {
          toast('Failed to login');
        }
      } catch (e: any) {
        toast(e.error || e.message || 'An error occurred during mock login');
      }
    });
  }
});
