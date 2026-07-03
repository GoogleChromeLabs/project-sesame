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

## Immediate UI mode

[Immediate UI
mode](https://developer.chrome.com/docs/identity/immediate-ui-mode) is a web
platform capability designed to streamline the sign-in experience. It allows
users to authenticate simply by selecting their account from a unified, native
browser dialog. This dialog aggregates all credentials saved in their password
manager, including both traditional passwords and modern passkeys.

Unlike the standard passkey prompt, immediate UI mode fails fast. If a user
cancels the biometric verification or if no matching credentials are found, the
API throws an exception immediately without falling back to a QR code or
external security key dialog.

### How to test this feature

1. **Browser prerequisite:** Ensure you are using a Chromium-based browser that
   supports immediate UI mode (available from June 2026 onwards).
2. **Save test credentials:** You must have at least one account with a password
   and a passkey saved in your password manager for this demo website. If you do
   not have any saved credentials, visit the [passkey form
   autofill](/passkey-form-autofill) page to save a password and register a new
   passkey, then return here. Creating a second account will show you how the UI
   let you pick an account.
3. **Trigger the sign-in prompt:** Click the **Sign-in** button on this page to
   launch the unified credential picker.
4. **Select your account:** Choose the saved account you want to sign in with
   from the native dialog.
5. **Complete user verification:** Perform the required verification (such as
   biometric scanning or entering your device PIN) if prompted. Once verified,
   you will be signed in immediately.
