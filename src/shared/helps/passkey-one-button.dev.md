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

## How to integrate passkey sign-in button

Use [WebAuthn](https://www.w3.org/TR/webauthn/) to build a passkey one button
experience by invoking `navigator.credentials.get()` with a public key option.

There are a lot of tricks you can perform to make the passkey authentication
experience better. Here's a checklist:

- Signal when a passkey's matching credential is not found on the backend with
  [`PublicKeyCredential.signalUnknownCredential()`](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-that-a-credential-does-not-exist).
- Prompt users to manually create a passkey if the user hasn't created one after
  a sign-in.
- [Automatically create a passkey (conditional
  create)](https://developer.chrome.com/docs/identity/webauthn-conditional-create)
  after the user signs in with a password (and a second factor).
- Prompt for local passkey creation [if the user has signed in with a
  cross-device
  passkey](https://web.dev/articles/passkey-form-autofill#encourage_creating_a_new_passkey_after_a_cross-device_authentication).
- [Signal the list of available
  passkeys](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-a-list-of-saved-credentials)
  and [updated user details (username, display
  name)](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-updated-username-and-display-name)
  to the provider after sign-in

### Learning resources

- [Sign in with a passkey through form
  autofill](https://web.dev/articles/passkey-form-autofill)
- [Server-side passkey
  authentication](https://developers.google.com/identity/passkeys/developer-guides/server-authentication)
- [Implement passkeys with form autofill in a web app](https://goo.gle/passkeys-codelab)
