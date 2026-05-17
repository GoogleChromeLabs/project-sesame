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

## How to integrate password based sign-in form

To perform **automatic passkey upgrades**, use **WebAuthn Conditional Create**.
Simply invoke `navigator.credentials.create()` with `mediation: "conditional"`
as soon as the user successfully authenticate with a password. There are a few
conditions to meet:

- A password is saved to the password manager.
- The password the user entered matches the one in the password manager.
- There is no passkey stored to the password manager yet.
- `navigator.credentials.create()` is invoked shortly after the user entered the
  password.

### Learning resources

- [Sign-in form best practices](https://web.dev/articles/sign-in-form-best-practices)
- [Automatically create passkeys for your users using Conditional
  Create](https://web.dev/articles/webauthn-conditional-create)
