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

This page demonstrates **passkey form autofill** (also known as Conditional UI),
which lets users sign in with either a passkey or a password through the same
form. It also demonstrates how the WebAuthn
[Signal API](https://developer.chrome.com/docs/identity/webauthn-signal-api)
helps clean up passkeys that remain in a password manager after their
corresponding credentials have been removed from the server.

### How to test it

1. Click or tap the **username field** to display the browser's autofill
   suggestions.
2. If your password manager has credentials saved for this site, choose one:

   - **Saved password:** Select it to fill in your username, then select
     **Continue** to proceed to the password step.
   - **Saved passkey:** Select it and follow the browser's verification
     prompt to sign in.

3. If you don't have saved credentials, enter any username and select
   **Continue**. On the next page, enter any password to create a demo
   account. The password is ignored; this step simulates a traditional
   sign-up flow.

### How the Signal API handles invalid passkeys

A passkey can remain in your password manager even after you delete its
corresponding credential from your account settings. If you try to sign in
with that passkey, the server rejects the attempt because it can no longer
find the matching public key.

The page then uses the WebAuthn Signal API to notify the passkey provider
that the credential is no longer recognized. A supporting password manager
can remove the invalid passkey so it is no longer offered for sign-in.
