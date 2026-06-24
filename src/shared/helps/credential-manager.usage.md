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

Immediate UI mode for logins is a web capability designed to streamline sign-in
flows. With immediate UI mode, users can sign in to a website just by selecting
an account displayed in a dedicated browser native dialog that unifies all
credential types (currently passwords and passkeys) saved to the password
manager.

Unlike passkey dialog, immediate UI mode doesn't show a QR code dialog even after the user cancels the biometric prompt.

To try out this feature, you need to have a password and a passkey saved to the
password manager. If you don't have any yet, please go [passkey form
autofill](/passkey-form-autofill) and save a password, then create a new
passkey and come back here.

When ready, click the **Sign-in** button. By selecting an account, you'll be
asked to perform user verification if necessary. Once verified, you'll be signed
in.
