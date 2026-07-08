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

## EVP Mock Provider (Issuer)

On this page, you can simulate an email provider (Identity Provider / Issuer) for the experimental **Email Verification Protocol (EVP)**.

When a user logs in to this mock provider, their browser can retrieve a signed cryptographic Email Verification Token (EVT) asserting ownership of their email address. Relying Parties (like our EVP Verifier demo) can then request this token from the browser to verify the user's email instantly without OTP codes or magic links.

### How to test it:

1. **Log in to the Mock Provider:** Click the **Log in as demo@...** button to establish an authenticated session on this Identity Provider origin.
2. **Visit the Relying Party (Verifier):** Open the EVP Verifier demo page (`/evp`).
3. **Select Email from Autofill:** Click the email input box on the Verifier page and select your logged-in email address from the browser's autofill dropdown.
4. **Verify:** Click **Verify**. The browser will request a signed EVT from this mock provider in the background and deliver it to the Verifier for cryptographic validation.
