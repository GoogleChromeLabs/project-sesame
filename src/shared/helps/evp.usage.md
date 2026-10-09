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

On this page, you can experience **Email Verification Protocol (EVP)** that instantly verifies your email address.

EVP allows browsers to securely share cryptographically verified email addresses with websites using verifiable credentials, eliminating the friction of waiting for OTP codes or clicking verification links in your inbox.

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

- **Enter the email address to the form:** Enter the email address
  **`demo@rowan.fyi`** to the input field, or click the email input field and
  choose **`demo@rowan.fyi`** from the browser's autofill dropdown.
- **Submit the form:** Click the **Continue** button. The browser will retrieve
  a signed cryptographic Email Verification Token (EVT) from the email provider
  and supply it to the page, completing the verification instantly.
- **Observe the console:** Open your browser's Developer Tools (Console tab) to
  inspect the step-by-step cryptographic verification trace and data outputs in
  real time.
- **Fallback to OTP:** If you type any other email address manually (or decline
  the browser prompt), the browser won't supply a token, and the page will fall
  back to simulating a traditional 6-digit verification code.
