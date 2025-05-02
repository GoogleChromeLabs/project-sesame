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
import {$, loading, redirect, toast} from '../helpers/index';
import {capabilities, authenticate} from '../helpers/publickey';

// --- NEW: Get redirect parameter 'r' early ---
const currentUrl = new URL(location.href);
const rParam = currentUrl.searchParams.get('r');

// --- NEW: Update the alternative sign-in link ---
// *** Adjust this selector to match your actual second button/link element ***
const alternativeLink = $('#password-signin'); // e.g., '#password-link', 'a[href="/signin-form"]'

if (alternativeLink && rParam) {
  try {
    // Construct the target URL, preserving existing params if any
    const targetUrl = new URL(alternativeLink.href, location.origin); // Use base URL for relative links
    targetUrl.searchParams.set('r', rParam); // Add or update the 'r' parameter
    alternativeLink.href = targetUrl.toString(); // Set the updated href
    console.log(`Updated alternative link href to: ${alternativeLink.href}`);
  } catch (error) {
    console.error("Failed to update alternative sign-in link's href:", error);
    // Avoid breaking the page if URL parsing fails
  }
} else if (!alternativeLink) {
  console.warn(
    'Could not find the alternative sign-in link element to update its href.'
  );
}
// --- End NEW ---

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
          // Use the rParam variable captured at the start.
          // TODO: This is an open redirect. Prevent it. (Validate rParam against allowed paths)
          redirect(rParam || '/home');
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
