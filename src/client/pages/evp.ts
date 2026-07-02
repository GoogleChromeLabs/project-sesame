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
import {$, post} from '~project-sesame/client/helpers/index';

document.addEventListener('DOMContentLoaded', () => {
  const emailFormContainer = $('#email-form-container') as HTMLDivElement;
  const evpForm = $('#evp-form') as HTMLFormElement;
  const emailInput = $('#email') as HTMLInputElement;
  const tokenInput = $('#evt') as HTMLInputElement;
  const submitBtn = $('#submit-btn') as HTMLButtonElement;

  const otpFallbackContainer = $('#otp-fallback-container') as HTMLDivElement;
  const fallbackEmailDisplay = $('#fallback-email-display') as HTMLSpanElement;
  const otpForm = $('#otp-form') as HTMLFormElement;
  const otpInput = $('#otp') as HTMLInputElement;
  const otpCancelBtn = $('#otp-cancel-btn') as HTMLElement;

  const successBanner = $('#success-banner') as HTMLDivElement;
  const verifiedEmailText = $('#verified-email-text') as HTMLSpanElement;
  const errorBanner = $('#error-banner') as HTMLDivElement;
  const errorMessageText = $('#error-message-text') as HTMLSpanElement;

  const overallStatus = $('#overall-status') as HTMLSpanElement;
  const traceStepsList = $('#trace-steps-list') as HTMLDivElement;
  const consoleLogTerminal = $('#console-log-terminal') as HTMLDivElement;

  // Set the nonce attribute dynamically to prevent the browser from stripping it during HTML parsing
  const nonce = tokenInput.getAttribute('data-nonce');
  if (nonce) {
    tokenInput.setAttribute('nonce', nonce);
    logToTerminal(
      `Local session challenge (nonce) bound to input: ${nonce}`,
      'system'
    );
  }

  // Set up tab navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (!targetTab) return;

      document
        .querySelectorAll('.tab-btn')
        .forEach(b => b.classList.remove('active'));
      document
        .querySelectorAll('.tab-content')
        .forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = $(`#tab-${targetTab}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });

  // Handle main EVP form submission
  evpForm.addEventListener('submit', async event => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const evt = tokenInput.value.trim();

    // Reset UI
    successBanner.classList.add('hidden');
    errorBanner.classList.add('hidden');
    otpFallbackContainer.classList.add('hidden');
    traceStepsList.innerHTML = '';
    consoleLogTerminal.innerHTML = '';

    logToTerminal(
      'Form submitted. Checking for browser-populated EVP token...',
      'system'
    );

    if (!evt) {
      logToTerminal(
        'EVP token NOT found in hidden input. Falling back to OTP flow.',
        'highlight'
      );
      setOverallStatus('failed', 'No EVP Token');

      emailFormContainer.classList.add('hidden');
      otpFallbackContainer.classList.remove('hidden');
      fallbackEmailDisplay.innerText = email;
      renderFallbackTrace(email);
      return;
    }

    logToTerminal(
      'EVP token found! Initiating server-side cryptographic verification...',
      'success'
    );
    logToTerminal(`Token: ${evt}`);
    setOverallStatus('verifying', 'Verifying...');
    submitBtn.disabled = true;

    try {
      const result = await post('/evp/verify', {email, evt});

      submitBtn.disabled = false;
      renderTrace(result.steps);

      if (result.success) {
        logToTerminal(
          'Verification succeeded! Email ownership cryptographically verified.',
          'success'
        );
        setOverallStatus('verified', 'Verified');
        successBanner.classList.remove('hidden');
        verifiedEmailText.innerText = result.verifiedEmail;
      } else {
        logToTerminal(`Verification failed: ${result.error}`, 'error');
        setOverallStatus('failed', 'Failed');
        errorBanner.classList.remove('hidden');
        errorMessageText.innerText =
          result.error || 'Cryptographic verification failed.';
      }
    } catch (e: any) {
      submitBtn.disabled = false;
      logToTerminal(
        `Server error during verification: ${e.message || e}`,
        'error'
      );
      setOverallStatus('failed', 'Error');
      errorBanner.classList.remove('hidden');
      errorMessageText.innerText =
        e.message || 'An unexpected server error occurred.';
    }
  });

  // Handle OTP fallback submission
  otpForm.addEventListener('submit', event => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const otp = otpInput.value.trim();

    if (!/^\d{6}$/.test(otp)) {
      logToTerminal('Invalid OTP format. Must be a 6-digit number.', 'error');
      return;
    }

    logToTerminal(`Simulating OTP verification for code: ${otp}...`, 'system');
    logToTerminal('OTP verified successfully!', 'success');

    otpFallbackContainer.classList.add('hidden');
    successBanner.classList.remove('hidden');
    verifiedEmailText.innerText = `${email} (verified via OTP fallback)`;
    setOverallStatus('verified', 'Verified (OTP)');
  });

  // Handle OTP Cancel button
  otpCancelBtn.addEventListener('click', () => {
    otpFallbackContainer.classList.add('hidden');
    emailFormContainer.classList.remove('hidden');
    setOverallStatus('idle', 'Idle');
    traceStepsList.innerHTML =
      '<div class="trace-placeholder">Submit the form to view the cryptographic trace steps.</div>';
    logToTerminal('Returned to email registration screen.', 'system');
  });

  /* Helper Functions */
  function logToTerminal(
    message: string,
    type: 'system' | 'success' | 'error' | 'highlight' | '' = ''
  ) {
    const lineEl = document.createElement('div');
    lineEl.className = `console-line ${type}`;

    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = `[${new Date().toLocaleTimeString()}]`;

    lineEl.appendChild(timestamp);
    lineEl.appendChild(document.createTextNode(` ${message}`));
    consoleLogTerminal.appendChild(lineEl);
    consoleLogTerminal.scrollTop = consoleLogTerminal.scrollHeight;
  }

  function setOverallStatus(
    statusClass: 'idle' | 'verifying' | 'verified' | 'failed',
    text: string
  ) {
    overallStatus.className = `status-badge ${statusClass}`;
    overallStatus.innerText = text;
  }

  function renderTrace(steps: any) {
    traceStepsList.innerHTML = '';

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

    stepMetadata.forEach(meta => {
      const stepKey = `step${meta.num}`;
      const stepData = steps[stepKey];
      if (!stepData) return;

      const stepEl = document.createElement('div');
      stepEl.className = `trace-step`;

      const headerEl = document.createElement('div');
      headerEl.className = 'trace-step-header';
      headerEl.innerHTML = `
        <div class="trace-step-title">
          <span class="step-num">${meta.num}</span>
          <span class="step-name">${escapeHtml(meta.name)}</span>
        </div>
        <span class="step-status ${stepData.status}">${stepData.status}</span>
      `;

      const bodyEl = document.createElement('div');
      bodyEl.className = 'trace-step-body';
      bodyEl.innerHTML = `
        <p class="step-desc">${escapeHtml(meta.desc)}</p>
        <div class="json-box-container">
          <button class="json-toggle">
            <span>Show Input / Output Data Traces</span>
            <span class="arrow">▼</span>
          </button>
          <div class="json-details hidden">
            <div class="json-label">Inputs Sent:</div>
            <pre class="json-data">${escapeHtml(JSON.stringify(stepData.inputs, null, 2))}</pre>
            <div class="json-label">Outputs Received:</div>
            <pre class="json-data">${escapeHtml(JSON.stringify(stepData.outputs, null, 2))}</pre>
          </div>
        </div>
      `;

      headerEl.addEventListener('click', () => {
        bodyEl.classList.toggle('open');
      });

      const jsonToggle = bodyEl.querySelector(
        '.json-toggle'
      ) as HTMLButtonElement;
      const jsonDetails = bodyEl.querySelector(
        '.json-details'
      ) as HTMLDivElement;
      const arrow = bodyEl.querySelector('.arrow') as HTMLSpanElement;

      jsonToggle.addEventListener('click', e => {
        e.stopPropagation();
        jsonDetails.classList.toggle('hidden');
        arrow.textContent = jsonDetails.classList.contains('hidden')
          ? '▼'
          : '▲';
      });

      stepEl.appendChild(headerEl);
      stepEl.appendChild(bodyEl);
      traceStepsList.appendChild(stepEl);

      // Log steps to terminal as they render
      const logType = stepData.status === 'success' ? 'success' : 'error';
      logToTerminal(
        `Step ${meta.num} (${meta.name}): ${stepData.status.toUpperCase()}`,
        logType
      );
    });
  }

  function renderFallbackTrace(email: string) {
    traceStepsList.innerHTML = `
      <div class="trace-step">
        <div class="trace-step-header" style="cursor: default;">
          <div class="trace-step-title">
            <span class="step-num">1</span>
            <span class="step-name">EVP Token Check</span>
          </div>
          <span class="step-status failed">missing</span>
        </div>
        <div class="trace-step-body open" style="display: block;">
          <p class="step-desc">The browser did not populate the <code>email-verification-token</code> hidden input. Falling back to OTP.</p>
        </div>
      </div>
      <div class="trace-step">
        <div class="trace-step-header" style="cursor: default;">
          <div class="trace-step-title">
            <span class="step-num">2</span>
            <span class="step-name">OTP Fallback Triggered</span>
          </div>
          <span class="step-status success">triggered</span>
        </div>
        <div class="trace-step-body open" style="display: block;">
          <p class="step-desc">A simulated 6-digit verification code has been dispatched to <code>${escapeHtml(email)}</code>.</p>
        </div>
      </div>
    `;
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});
