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

This page shows **passkey form autofill** (also known as conditional UI), which
lets you sign in with a passkey or a password from the same form. It also covers
the
[WebAuthn Signal API](https://developer.chrome.com/docs/identity/webauthn-signal-api),
which removes invalid or orphaned passkeys.

### How to test it

1. Click or tap the username field to open the browser's autofill suggestions.
2. Depending on what is saved for this site, do one of the following:
   - **Select a saved password**: The username fills in automatically. Click
     **Continue** to move to the password step.
   - **Select a saved passkey**: A browser verification prompt appears.
     Complete the verification to sign in.
   - **Nothing saved yet**: Enter any username and click **Continue**. On the
     next page, enter any password to register. The password is ignored, but
     the step simulates a traditional sign-up flow.

### Removing orphaned passkeys

If the server rejects a passkey sign-in because the corresponding public key is
not found (e.g., if you deleted the credential from your account settings but
the passkey remains in your password manager), the page uses the
[WebAuthn Signal API](https://developer.chrome.com/docs/identity/webauthn-signal-api)
to tell the browser that the credential no longer exists. Your password manager
then removes the invalid passkey, preventing future confusion.
