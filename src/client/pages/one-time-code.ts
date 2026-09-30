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

const otpForm = $('#otp-form') as HTMLFormElement;
const otpInput = $('#otp') as HTMLInputElement;
const otpSubmitBtn = $('#otp-submit-btn') as HTMLButtonElement;
const email = ($('#pending-email') as HTMLElement).innerText;

/**
 * Explains in the console why the user ended up on this page instead of
 * having the email address verified instantly with EVP.
 */
function printFallbackTraceToConsole(): void {
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

/**
 * Verifies the code for the address the server keeps as pending, then moves
 * on to passkey creation. The server puts the session into the sign-up state
 * on success, which `/new-passkey` requires.
 */
otpForm.addEventListener('submit', async event => {
  event.preventDefault();
  const otp = otpInput.value.trim();

  if (!/^\d{6}$/.test(otp)) {
    toast('Enter the 6-digit code.');
    return;
  }

  otpSubmitBtn.disabled = true;
  try {
    await post('/evp/otp', {otp});
    console.info(`One-time code accepted (simulated) for ${email}.`);
    await redirect('/new-passkey');
  } catch (e: any) {
    const message = e?.error || e?.message || 'Failed to verify the code.';
    console.error(`OTP verification failed: ${message}`);
    toast(message);
    otpSubmitBtn.disabled = false;
  }
});

printFallbackTraceToConsole();
