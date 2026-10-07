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

import '~project-sesame/client/layout';
import {$, post, redirect, toast} from '~project-sesame/client/helpers/index';

/**
 * A single step in the server-side verification trace returned by
 * `/evp/signup`.
 */
interface VerificationStep {
  status: 'pending' | 'success' | 'failed';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

/**
 * Extracts a human-readable message from an error thrown by `post()` (which
 * throws the parsed JSON body) or by WebAuthn (which throws a `DOMException`).
 *
 * @param error - The caught value.
 * @param fallback - The message to use when nothing better is available.
 * @returns The message to show to the user.
 */
function errorMessage(error: any, fallback: string): string {
  return error?.error || error?.message || fallback;
}

/**
 * Wires up the email step and restores the EVP nonce attribute.
 */
function initPage(): void {
  const evpForm = $('#evp-form') as HTMLFormElement;
  const emailInput = $('#email') as HTMLInputElement;
  const tokenInput = $('#evt') as HTMLInputElement;
  const submitBtn = $('#submit-btn') as HTMLButtonElement;

  // Restore the `nonce` content attribute. Because this page is served with a
  // CSP header, the browser's nonce hiding blanks `nonce` to "" when the
  // element is inserted (the value survives only in the `.nonce` IDL
  // property). Chrome's autofill reads the content attribute when requesting
  // an Email Verification Token, so copy the server-rendered value back from
  // `data-nonce`. Setting it after insertion is not hidden again.
  const nonce = tokenInput.getAttribute('data-nonce');
  if (nonce) {
    tokenInput.setAttribute('nonce', nonce);
    console.info(`Local session challenge (nonce) bound to input: ${nonce}`);
  }

  // Submit the email. Use the EVP token if the browser supplied one, and fall
  // back to a one-time code otherwise.
  evpForm.addEventListener('submit', async event => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const evt = tokenInput.value.trim();

    console.info('Form submitted. Checking for browser-populated EVP token...');
    submitBtn.disabled = true;

    try {
      if (!evt) {
        console.warn(
          'EVP token NOT found in hidden input. Falling back to OTP flow.'
        );
        // The server keeps the address as pending, and `/one-time-code`
        // verifies that address rather than one sent by the client.
        await post('/evp/otp/request', {email});
        await redirect('/one-time-code');
        return;
      }

      console.info(
        'EVP token found! Initiating server-side cryptographic verification...'
      );
      console.log(`Token: ${evt}`);

      const result = await post('/evp/signup', {email, evt});
      printTraceToConsole(result.steps);

      if (result.success) {
        console.info(
          `Verification succeeded! Ownership of ${result.verifiedEmail || email} cryptographically verified.`
        );
        // The server has put the session into the sign-up state for the
        // verified address, which `/new-passkey` requires.
        await redirect('/new-passkey');
      } else {
        console.error(`Verification failed: ${result.error}`);
        toast(result.error || 'Cryptographic verification failed.');
      }
    } catch (e: any) {
      const message = errorMessage(e, 'An unexpected server error occurred.');
      console.error(`Server error during verification: ${message}`);
      toast(message);
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* Console Printing Helpers */
  function printTraceToConsole(steps: Record<string, VerificationStep>) {
    const stepMetadata = [
      {
        num: 1,
        name: 'Token Decomposition & Parsing',
        desc: 'Decompose the submitted token into its distinct EVT and Key Binding JWT (KB-JWT) components, and perform local decoding of their headers and payloads.',
      },
      {
        num: 2,
        name: 'Local Claims & Session Binding',
        desc: 'Verify local, non-cryptographic claims (email match, verification status, audience, nonce, and cryptographic hash binding) to fail fast before doing network or crypto operations.',
      },
      {
        num: 3,
        name: 'DNS Delegation Authority',
        desc: "Perform dynamic server-side DNS queries to confirm that the email's domain delegated verification authority to the token issuer.",
      },
      {
        num: 4,
        name: 'Issuer Discovery & JWKS Fetching',
        desc: "Fetch the issuer's well-known configuration and JWKS public keys from their authoritative origin.",
      },
      {
        num: 5,
        name: 'Issuer Signature Cryptographic Verification',
        desc: 'Cryptographically verify the EVT signature using the fetched issuer public keys from their JWKS.',
      },
      {
        num: 6,
        name: 'Ephemeral Key Binding Verification',
        desc: "Extract the browser's ephemeral public key from the validated EVT and cryptographically verify the KB-JWT signature to prove possession of the private key.",
      },
    ];

    console.group(
      '%cEVP Cryptographic Verification Trace',
      'font-weight: bold; font-size: 13px; color: #1a73e8;'
    );
    stepMetadata.forEach(meta => {
      const stepKey = `step${meta.num}`;
      const stepData = steps?.[stepKey];
      if (!stepData) return;

      console.groupCollapsed(
        `Step ${meta.num}: ${meta.name} [${stepData.status.toUpperCase()}]`
      );
      console.log(`Description: ${meta.desc}`);
      console.log('Inputs:', stepData.inputs);
      console.log('Outputs:', stepData.outputs);
      console.groupEnd();
    });
    console.groupEnd();
  }
}

// This module may evaluate after DOMContentLoaded has fired (e.g. if any
// imported module uses top-level await), so run the initializer immediately
// when the DOM is already parsed.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
