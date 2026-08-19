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
import {$, post, toast} from '~project-sesame/client/helpers/index';

document.addEventListener('DOMContentLoaded', () => {
  const emailFormContainer = $('#email-form-container') as HTMLDivElement;
  const evpForm = $('#evp-form') as HTMLFormElement;
  let emailInput = $('#email') as HTMLInputElement;
  let tokenInput = $('#evt') as HTMLInputElement;
  const submitBtn = $('#submit-btn') as HTMLButtonElement;

  const otpFallbackContainer = $('#otp-fallback-container') as HTMLDivElement;
  const fallbackEmailDisplay = $('#fallback-email-display') as HTMLSpanElement;
  const otpForm = $('#otp-form') as HTMLFormElement;
  const otpInput = $('#otp') as HTMLInputElement;
  const otpCancelBtn = $('#otp-cancel-btn') as HTMLElement;

  // Set the nonce attribute dynamically to prevent the browser from stripping it during HTML parsing
  const nonce = tokenInput.getAttribute('data-nonce');
  if (nonce) {
    tokenInput.setAttribute('nonce', nonce);
    console.info(`Local session challenge (nonce) bound to input: ${nonce}`);
  }

  const successContainer = $('#success-container') as HTMLDivElement;
  const verifiedEmailText = $('#verified-email-text') as HTMLSpanElement;
  const backBtn = $('#back-btn') as HTMLButtonElement;

  // Handle main EVP form submission
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

      submitBtn.disabled = false;
      printTraceToConsole(result.steps);

      if (result.success) {
        console.info(
          'Verification succeeded! Email ownership cryptographically verified.'
        );

        // Show success screen
        emailFormContainer.classList.add('hidden');
        verifiedEmailText.innerText = result.verifiedEmail || email;
        successContainer.classList.remove('hidden');
      } else {
        console.error(`Verification failed: ${result.error}`);
        toast(result.error || 'Cryptographic verification failed.');
      }
    } catch (e: any) {
      submitBtn.disabled = false;
      console.error(`Server error during verification: ${e.message || e}`);
      toast(e.message || 'An unexpected server error occurred.');
    }
  });

  // Handle Back button on Success screen
  backBtn.addEventListener('click', () => {
    // Reset form values
    evpForm.reset();

    // Recreate email input to clear browser-bound verification / autofill states
    const newEmailInput = emailInput.cloneNode(true) as HTMLInputElement;
    newEmailInput.value = '';
    emailInput.parentNode?.replaceChild(newEmailInput, emailInput);
    emailInput = newEmailInput;

    // Recreate token input
    const newTokenInput = tokenInput.cloneNode(true) as HTMLInputElement;
    newTokenInput.value = '';

    // Rebind nonce attributes
    const nonceAttr = newTokenInput.getAttribute('data-nonce');
    if (nonceAttr) {
      newTokenInput.setAttribute('nonce', nonceAttr);
    }
    tokenInput.parentNode?.replaceChild(newTokenInput, tokenInput);
    tokenInput = newTokenInput;

    // Reset UI visibility
    successContainer.classList.add('hidden');
    emailFormContainer.classList.remove('hidden');
    console.info(
      'Form reset and inputs recreated. Ready to verify another email.'
    );
  });

  // Handle OTP fallback submission
  otpForm.addEventListener('submit', event => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const otp = otpInput.value.trim();

    if (!/^\d{6}$/.test(otp)) {
      console.error('Invalid OTP format. Must be a 6-digit number.');
      toast('Invalid OTP format. Must be 6 digits.');
      return;
    }

    console.info(`Simulating OTP verification for code: ${otp}...`);
    console.info('OTP verified successfully!');

    otpFallbackContainer.classList.add('hidden');
    emailFormContainer.classList.remove('hidden');
    toast(`Email verified via OTP: ${email}`);
  });

  // Handle OTP Cancel button
  otpCancelBtn.addEventListener('click', () => {
    otpFallbackContainer.classList.add('hidden');
    emailFormContainer.classList.remove('hidden');
    console.info('Returned to email registration screen.');
  });

  /* Console Printing Helpers */
  function printTraceToConsole(steps: any) {
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
      const stepData = steps[stepKey];
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
      `Description: A simulated 6-digit verification code has been dispatched to ${email}.`
    );
    console.groupEnd();
    console.groupEnd();
  }
});
