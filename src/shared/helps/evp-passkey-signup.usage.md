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

## Sign-up with email verification and passkey

On this page, you can experience a fully passwordless sign-up. You verify your
email address in the browser with the **Email Verification Protocol (EVP)**,
then create a **passkey** to finish setting up your account. No password is
created at any point.

EVP allows browsers to share verified email addresses with websites using a
signed Email Verification Token (`SD-JWT+KB`), eliminating the friction of
waiting for OTP codes or clicking verification links in your inbox. Pairing it
with a passkey means the account is protected by a phishing-resistant
credential from the very first sign-in.

### Prerequisites

- **Browser support:** Ensure you are using a compatible browser (**Requires
  Chrome 150+**).
- **Log in to the email provider:** Visit the [EVP Email
  Provider](https://rowan.fyi/made/email-provider) and log in with the demo
  email address (**`demo@rowan.fyi`**) via our demo email provider.
- **(Optional) Add to your browser autofill:** In Chrome, navigate to
  `chrome://settings/addresses`, click **Add**, enter **`demo@rowan.fyi`** in
  the **Email** field, and save. Leave other fields blank.

### How to test the demo:

- **Enter the email address:** Type **`demo@rowan.fyi`** into the input field,
  or click the field and choose **`demo@rowan.fyi`** from the browser's
  autofill dropdown.
- **Verify your email:** Click the **Continue** button. The browser retrieves a
  signed Email Verification Token (EVT) from the email provider and supplies it
  to the page, and the server verifies it instantly.
- **Create a passkey:** Once your email is verified, you're taken to the next
  page. Click **Create a passkey** there and complete the browser prompt. The
  account is created only after the passkey is registered, and you'll be signed
  in and taken to the home page.
- **Observe the console:** Open your browser's Developer Tools (Console tab) to
  inspect the step-by-step cryptographic verification trace and data outputs in
  real time.
- **Fallback to a one-time code:** If you type any other email address manually
  (or decline the browser prompt), the browser won't supply a token, and you're
  taken to a page to enter a traditional 6-digit verification code instead.
  **This demo doesn't send any email, so any 6 digits will be accepted.** You
  then continue to passkey creation as usual.
- **Try it again:** Each email address can be registered only once. To repeat
  the demo with the same address, delete the account from **Settings** first,
  and remove the passkey from your password manager.
