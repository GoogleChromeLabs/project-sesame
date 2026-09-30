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
import {
  capabilities,
  registerCredential,
} from '~project-sesame/client/helpers/publickey';

/**
 * How the email address was verified. Shown to the user on the passkey step so
 * the difference between the instant EVP path and the fallback is visible.
 */
type VerificationMethod = 'evp' | 'otp';

/**
 * A single step in the server-side verification trace returned by
 * `/evp/verify`.
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
 * Wires up the three sign-up steps and restores the EVP nonce attribute.
 */
function initPage(): void {
  const emailFormContainer = $('#email-form-container') as HTMLDivElement;
  const evpForm = $('#evp-form') as HTMLFormElement;
  const emailInput = $('#email') as HTMLInputElement;
  const tokenInput = $('#evt') as HTMLInputElement;
  const submitBtn = $('#submit-btn') as HTMLButtonElement;

  const otpFallbackContainer = $('#otp-fallback-container') as HTMLDivElement;
  const fallbackEmailDisplay = $('#fallback-email-display') as HTMLSpanElement;
  const otpForm = $('#otp-form') as HTMLFormElement;
  const otpInput = $('#otp') as HTMLInputElement;
  const otpSubmitBtn = $('#otp-submit-btn') as HTMLButtonElement;
  const otpCancelBtn = $('#otp-cancel-btn') as HTMLElement;

  const passkeyContainer = $('#passkey-container') as HTMLDivElement;
  const verifiedEmailText = $('#verified-email-text') as HTMLSpanElement;
  const verificationMethodText = $(
    '#verification-method-text'
  ) as HTMLSpanElement;
  const createPasskeyBtn = $('#create-passkey-btn') as HTMLButtonElement;

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

  /**
   * Moves the UI to the final step, where the user creates a passkey. The
   * server has already put the session into the sign-up state for `email`.
   *
   * @param email - The verified email address.
   * @param method - How the address was verified.
   */
  function showPasskeyStep(email: string, method: VerificationMethod): void {
    emailFormContainer.classList.add('hidden');
    otpFallbackContainer.classList.add('hidden');
    verifiedEmailText.innerText = email;
    verificationMethodText.innerText =
      method === 'evp'
        ? 'instantly with the Email Verification Protocol'
        : 'with a one-time code';
    passkeyContainer.classList.remove('hidden');
    console.info(
      `Email verified via ${method.toUpperCase()}. Ready to create a passkey for ${email}.`
    );
  }

  // Step 1: Submit the email. Use the EVP token if the browser supplied one.
  evpForm.addEventListener('submit', async event => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const evt = tokenInput.value.trim();

    console.info('Form submitted. Checking for browser-populated EVP token...');

    if (!evt) {
      console.warn(
        'EVP token NOT found in hidden input. Falling back to OTP flow.'
      );

      emailFormContainer.classList.add('hidden');
      otpFallbackContainer.classList.remove('hidden');
      fallbackEmailDisplay.innerText = email;
      printFallbackTraceToConsole(email);
      return;
    }

    console.info(
      'EVP token found! Initiating server-side cryptographic verification...'
    );
    console.log(`Token: ${evt}`);
    submitBtn.disabled = true;

    try {
      const result = await post('/evp/verify', {email, evt});
      printTraceToConsole(result.steps);

      if (result.success) {
        console.info(
          'Verification succeeded! Email ownership cryptographically verified.'
        );
        showPasskeyStep(result.verifiedEmail || email, 'evp');
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

  // Step 2 (fallback): Verify the simulated one-time code on the server.
  otpForm.addEventListener('submit', async event => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const otp = otpInput.value.trim();

    if (!/^\d{6}$/.test(otp)) {
      console.error('Invalid OTP format. Must be a 6-digit number.');
      toast('Enter the 6-digit code.');
      return;
    }

    console.info(`Submitting simulated one-time code: ${otp}...`);
    otpSubmitBtn.disabled = true;

    try {
      const result = await post('/evp/otp', {email, otp});
      console.info('One-time code accepted (simulated).');
      showPasskeyStep(result.verifiedEmail || email, 'otp');
    } catch (e: any) {
      const message = errorMessage(e, 'Failed to verify the code.');
      console.error(`OTP verification failed: ${message}`);
      toast(message);
    } finally {
      otpSubmitBtn.disabled = false;
    }
  });

  // Return from the one-time code step to the email step.
  otpCancelBtn.addEventListener('click', () => {
    otpFallbackContainer.classList.add('hidden');
    emailFormContainer.classList.remove('hidden');
    console.info('Returned to email registration screen.');
  });

  // Step 3: Create a passkey. The server creates the account once the passkey
  // is registered, and signs the user in.
  createPasskeyBtn.addEventListener('click', async () => {
    createPasskeyBtn.disabled = true;
    // Registration requests a platform authenticator by default. If none is
    // available, allow any authenticator (a security key or a phone) instead
    // so the sign-up can still complete without a password.
    const nonPlatform = !capabilities?.userVerifyingPlatformAuthenticator;

    try {
      await registerCredential(nonPlatform);
      console.info('Passkey created. The account is ready.');
      await redirect('/home');
    } catch (e: any) {
      createPasskeyBtn.disabled = false;
      if (e?.name === 'InvalidStateError') {
        // A passkey for this account already exists on the authenticator.
        toast('A passkey already exists for this device.');
      } else if (e?.name === 'NotAllowedError') {
        // The user dismissed the passkey dialog. Let them try again.
        toast('Passkey creation was canceled. Try again when you are ready.');
      } else {
        const message = errorMessage(e, 'Failed to create a passkey.');
        console.error(e);
        toast(message);
      }
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

  function printFallbackTraceToConsole(email: string) {
    console.group(
      '%cEVP Verification Fallback Trace',
      'font-weight: bold; font-size: 13px; color: #c5221f;'
    );
    console.groupCollapsed('Step 1: EVP Token Check [FAILED]');
    console.log(
      'Description: The browser did not populate the email-verification-token hidden input. This happens when the user types the email manually, declines permission, or uses a browser/domain that does not support EVP.'
    );
    console.groupEnd();

    console.groupCollapsed('Step 2: OTP Fallback [TRIGGERED]');
    console.log(
      `Description: A real site would email a 6-digit code to ${email}. This demo sends nothing, and the server accepts any 6-digit code.`
    );
    console.groupEnd();
    console.groupEnd();
  }
}

// Importing helpers/publickey (which uses top-level await) turns this file
// into an async module that can evaluate after DOMContentLoaded has fired.
// Run the initializer immediately if the DOM is already parsed.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
