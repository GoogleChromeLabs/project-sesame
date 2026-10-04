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
 limitations under the License
-->

## Reauthentication with a passkey

On this page, you can experience how passkeys simplify and secure reauthentication (often called "step-up authentication").

Reauthentication is required when a user attempts to perform sensitive actions or access protected account areas, such as:

- Changing an email address or password.
- Managing security credentials or linked accounts.
- Accessing personal or financial information.

Instead of prompting users to re-enter a complex password, passkeys allow them to verify their identity in seconds using their device's biometric sensor (such as a fingerprint or facial recognition) or device lock PIN.

### How to test it

- **Prerequisites:** Sign in to an existing account that has at least one registered passkey. If you don't have an account with a passkey, register one first on the home or account settings page.
- **Select the verification button:** Click the **Verify** button to initiate the passkey reauthentication prompt.
- **Verify your identity:** When prompted by the browser, complete user verification with your passkey (e.g., via Touch ID, Face ID, or Windows Hello).
- **Alternative verification:** If needed, you can select **Verify with a password instead** to fall back to traditional password-based reauthentication.
- **Resume sensitive flow:** Once verified, you are redirected back to your original destination with an elevated session status.
