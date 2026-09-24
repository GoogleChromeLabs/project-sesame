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

**Conditional Create** is a WebAuthn API feature that lets your application
ask a password manager to create a passkey automatically after a user signs
in with a password. This helps users adopt passkeys without a separate setup
step or a visit to their account settings.

### When passkey creation is available

Requirements vary by browser and password manager. Typically, the user must
have a password saved for your site, and the password they use to sign in must
match the saved one. The password manager may decline to create a passkey if
one already exists for the account.

### How to integrate it

- **Request creation after sign-in:** Call `navigator.credentials.create()`
  with `mediation: 'conditional'` shortly after successful password
  authentication. If your flow includes a second authentication step, wait
  until that step is complete. The allowed time window depends on the browser
  and password manager.
- **Keep sign-in uninterrupted:** If conditional creation fails with an
  expected error, let the user continue without displaying an error message.
  Passkey creation should not block a successful sign-in.
- **Verify and register the passkey:** Send the returned credential to your
  server for verification and registration. For conditional registration,
  accept unset user presence (`UP`) and user verification (`UV`) flags while
  retaining all other registration checks.

### Developer resources

[Automatically create passkeys for your users using Conditional Create](https://developer.chrome.com/docs/identity/webauthn-conditional-create)
