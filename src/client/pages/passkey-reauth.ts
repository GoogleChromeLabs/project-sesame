/*
 * @license
 * Copyright 2024 Google Inc. All rights reserved.
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

import '../layout';
import {$, loading, redirect, toast, setRedirect} from '../helpers/index';
import {capabilities, authenticate} from '../helpers/publickey';

setRedirect('#password-signin');

// Feature detection: check if WebAuthn is supported.
// Note: The original code checked for userVerifyingPlatformAuthenticator,
// but the authenticate() call doesn't seem to require it specifically here.
// Sticking with the original check for consistency.
if (capabilities?.userVerifyingPlatformAuthenticator) {
  $('#hidden').classList.remove('hidden');
  $('#unsupported').classList.add('hidden');

  $('#passkey-signin').addEventListener(
    'click',
    async (e: {target: HTMLButtonElement}) => {
      try {
        loading.start();
        const user = await authenticate(); // Authenticate using passkey
        if (user) {
          // If `r` was specified in the original URL, redirect the user there.
          // Use the `r` variable captured at the start.
          // TODO: This is an open redirect. Prevent it. (Validate r against allowed paths)
          redirect(r || '/home');
        } else {
          // This case might not be reachable if authenticate throws on failure,
          // but kept for robustness.
          throw new Error('User not found or authentication failed.');
        }
      } catch (error: any) {
        loading.stop();
        console.error('Passkey authentication error:', error);
        // Don't show toast for user cancellation
        if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
          toast(error.message || 'Passkey authentication failed.');
        }
      }
    }
  );
}
