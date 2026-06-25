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

## Passkey form autofill

On this page, you can experience a sign-in flow that seamlessly accommodates
both passkeys and passwords in a single form—a feature known as "passkey form
autofill" (or conditional UI). This page also demonstrates how the WebAuthn
[Signal API](https://developer.chrome.com/docs/identity/webauthn-signal-api) can
be used to clean up invalid or orphaned passkeys.

### How to test it:

1. **Click or tap the username field** to trigger the browser's autofill suggestions.
2. If you have credentials saved in your password manager for this site:
   - **Selecting a saved password**: The username will be filled in
     automatically. Click **Continue** to proceed to the password step.
   - **Selecting a saved passkey**: A browser verification prompt will appear
     immediately. Complete the verification to sign in instantly.
3. If you don't have a passkey or account yet, enter any username and click
   **Continue**. On the next page, you can enter any password to register (the
   password will be ignored, but it simulates a traditional sign-up flow).

### WebAuthn Signal API Demo:

If a passkey sign-in attempt is rejected by the server because the corresponding
public key is not found (e.g., if the user deleted their credential from their
account settings but the local passkey remains in their password manager), the
server uses the WebAuthn Signal API to signal the browser. The browser's
password manager will then delete the invalid passkey, preventing future
confusion.
