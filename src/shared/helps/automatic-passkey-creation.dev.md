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

## Integrating automatic passkey creation

Automatic passkey creation uses the WebAuthn **Conditional Create** API. This
API lets password managers detect when a user signs in with a traditional
password and offer to create a passkey for the account immediately after a
successful sign-in. This helps drive passkey adoption without requiring the
user to visit a settings page.

Call `navigator.credentials.create()` with `mediation: "conditional"` shortly
after the user successfully authenticates with a traditional password. The
duration depends on the browser. If the sign-in flow includes a second
authentication step, call `navigator.credentials.create()` after the user
successfully completes that step.

### Key integration conditions

- **Saved password:** A password must be saved in the browser's password
  manager.
- **Matching password:** The password entered by the user must match the password
  stored in the password manager.
- **No existing passkey:** There must be no existing passkey for the account in
  the password manager.
- **Immediate invocation:** Call `navigator.credentials.create()` shortly after
  password authentication completes.
- **Ignore errors:** Gracefully ignore errors from the conditional create call so
  the user can continue to the homepage.
- **User presence off:** The resulting credential has `user presence` set to
  off. Skip the `UP` flag check on the server side.

### Learning resources

- [Automatically create passkeys for your users using Conditional Create](https://developer.chrome.com/docs/identity/webauthn-conditional-create)
