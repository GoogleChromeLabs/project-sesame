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

## Passwordless sign-up with email verification

On this page, you can experience a fully passwordless sign-up. You verify your email address instantly with the experimental **Email Verification Protocol (EVP)**, then create a **passkey** to finish setting up your account. No password is created at any point.

EVP allows browsers to securely share cryptographically verified email addresses with websites using verifiable credentials, eliminating the friction of waiting for OTP codes or clicking verification links in your inbox. Pairing it with a passkey means the account is protected by a phishing-resistant credential from the very first sign-in.

### How to test the demo:

- **Browser prerequisites:**
  1. Ensure you are using a compatible browser version (**Requires Chrome 150+**).
  2. Enable the Email Verification Protocol flag: `chrome://flags/#email-verification-protocol`.
- **Log in to the email provider:**
  For this demo, we expect you to log in with the provided demo email address (**`demo@rowan.fyi`**) via our demo email provider.
  1. Open a new tab and visit the [EVP Email Provider](https://rowan.fyi/made/email-provider).
  2. Follow the provider's instructions to ensure your browser is logged in as `demo@rowan.fyi`.
- **Add to your browser autofill:**
  To test the cryptographic flow smoothly, you must add the demo email to your browser's autofill addresses.
  1. In Chrome, navigate to `chrome://settings/addresses`.
  2. Click **Add**, enter **`demo@rowan.fyi`** in the **Email** field, and save. Leave other fields blank.
- **Select the email from autofill:**
  Return to this page, click the email input field, and choose **`demo@rowan.fyi`** from the browser's autofill dropdown.
- **Verify your email:**
  Click the **Continue** button. The browser retrieves a signed Email Verification Token (EVT) from the email provider and supplies it to the page, and the server verifies it instantly.
- **Create a passkey:**
  Once your email is verified, click **Create a passkey** and complete the browser prompt. The account is created only after the passkey is registered, and you'll be signed in and taken to the home page.
- **Observe the console:** Open your browser's Developer Tools (Console tab) to inspect the step-by-step cryptographic verification trace and data outputs in real time.
- **Fallback to a one-time code:** If you type an email address manually (or decline the browser prompt), the browser won't supply a token, and the page falls back to a traditional 6-digit verification code. **This demo doesn't send any email, so any 6 digits will be accepted.** You then continue to passkey creation as usual.
- **Try it again:** Each email address can be registered only once. To repeat the demo with the same address, delete the account from **Settings** first, and remove the passkey from your password manager.
