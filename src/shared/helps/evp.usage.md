<!--
 Copyright 2026 Google Inc. All rights reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

## Email Verification Protocol

On this page, you can experience a secure registration flow that instantly verifies the user's email address using the experimental **Email Verification Protocol (EVP)**.

EVP allows browsers to securely share cryptographically verified email addresses (stored in the browser or Google Account) with websites using verifiable credentials, eliminating the need to send OTP codes or verification links.

### How to test it:

- **Browser prerequisites:**
  1. Ensure you are using Chrome Canary or Dev channel.
  2. Enable the Email Verification Protocol flag: `chrome://flags/#email-verification-protocol`.
  3. **For local testing:** Enable the insecure localhost flag: `chrome://flags/#allow-insecure-localhost`. This is **mandatory** for Chrome to allow background requests to `https://idp.localhost` with our local self-signed SSL certificates.
- **Google Account requirement:** Ensure you are logged into your Google Account in the active browser profile.
- **Select email from autofill:** Click the email input field and choose your email address from the browser's autofill dropdown.
  > [!TIP]
  > **Testing with custom mock emails:** To test the cryptographic flow with a mock email (like `demo@chrome.dev` or `demo@idp.localhost`), you must first add it to your browser's autofill addresses. In Chrome, go to `chrome://settings/addresses`, click **Add**, fill in the **Email** field, and save. Leave other fields blank. Now it will appear in the dropdown.
- **Test with a demo email address (privacy-friendly):** To test the real cryptographic flow without using your personal Google Account, you can use our built-in mock Identity Provider:
  1. Open a new tab and visit our local mock provider page at `https://idp.localhost/`.
  2. Register or log in to an account with a custom email (e.g., **`demo@chrome.dev`** or **`demo@idp.localhost`**).
  3. Return to this page (`https://rp.localhost/evp`), click the email input field, select your registered email (e.g. **`demo@chrome.dev`**) from the browser autofill list, and click **Verify**.
  4. The browser will retrieve a signed cryptographic token from our local mock provider `idp.localhost` (bypassing DNS authority validation for development), and our local server will verify it end-to-end.
- **Submit the form:** Click the **Verify** button. The browser will supply a cryptographic Email Verification Token (EVT) that the server verifies.
- **Observe the console:** Open Chrome DevTools (Console tab) to inspect the step-by-step cryptographic verification trace and data outputs.
- **Fallback to OTP:** If you type any other fake email address manually (or decline permission), the browser won't supply a token, and the page will fallback to simulating a traditional 6-digit verification code.
