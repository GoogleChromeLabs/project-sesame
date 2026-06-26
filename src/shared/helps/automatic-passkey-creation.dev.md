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

Automatic passkey creation is implemented via the WebAuthn **Conditional
Create** API. This API allows password managers to detect when a user signs in
with a traditional password and offer to upgrade their account to a passkey on
the spot. This drives passkey adoption by creating a passkey automatically at
the exact moment they successfully authenticate, without requiring them to
navigate to a settings page.

Invoke `navigator.credentials.create()` with `mediation: "conditional"` soon
after the user successfully authenticates with a traditional password (the
duration depends on the browser). If you have a second step authentication,
invoke it after the user successfully signed in.

### Key integration conditions:

- **Saved password:** A password must be saved in the browser's password
  manager.
- **Matching password:** The password entered by the user must match the one
  stored in the password manager.
- **No existing passkeys:** There must be no existing passkey for this account
  in the password manager.
- **Immediate invocation:** `navigator.credentials.create()` must be called
  shortly after password authentication is completed.
- **Ignore errors:** To let the user smoothly land on the homepage, gracefully
  ignore errors caused by a conditional create call.
- **User presence off:** The resulting credential has a `user presence` off.
  Make sure you skip the `UP` flag check on the server side.

### Learning resources

- [Automatically create passkeys for your users using Conditional Create](https://developer.chrome.com/docs/identity/webauthn-conditional-create)
