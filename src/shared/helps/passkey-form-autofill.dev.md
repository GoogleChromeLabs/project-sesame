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

## Integrating passkey form autofill

To integrate **passkey form autofill** (also known as Conditional UI) using the
[WebAuthn API](https://www.w3.org/TR/webauthn/), your application must
orchestrate both frontend HTML/JS configurations and backend verification
checks.

- **Enable conditional mediation:** Pass `mediation: 'conditional'` as an option
  to the `navigator.credentials.get()` call when initiating the passkey sign-in
  request.
- **Configure form autocomplete:** The corresponding username/password `<input>`
  element must include `webauthn` in its `autocomplete` attribute (e.g.,
  `autocomplete="username webauthn"`).
- **Abort controller setup:** Use an `AbortController` to cancel any outstanding
  conditional UI requests before initiating a new WebAuthn call or transitioning
  pages, avoiding browser-level resource lockups.

### Best practices & advanced UX checklist

To deliver a top-tier passkey experience, consider implementing these advanced patterns and API integrations:

- **Orphaned credential cleanup:** Use the WebAuthn Signal API's
  [`PublicKeyCredential.signalUnknownCredential()`](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-that-a-credential-does-not-exist)
  to notify the browser when a passkey's matching public key is not found on the
  server, allowing the browser to delete the invalid credential.
- **Proactive passkey creation:** Prompt users to create a passkey immediately
  after they successfully sign in using a traditional password.
- **Seamless passkey creation (conditional create):** Use [conditional
  creation](https://developer.chrome.com/docs/identity/webauthn-conditional-create)
  to automatically create a passkey after they sign in using a password (and a
  second factor).
- **Encourage creating a new passkey after signing in cross-device:** If a user
  signs in using a cross-device passkey (e.g., scanning a QR code with their
  phone), [prompt them to create a new
  passkey](https://web.dev/articles/passkey-form-autofill#encourage_creating_a_new_passkey_after_a_cross-device_authentication)
  on their current device for faster future logins.
- **Synchronize credential state:** Use the WebAuthn Signal API to [signal the
  list of active
  passkeys](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-a-list-of-saved-credentials)
  or .

### Developer resources

- **Guide:** [Sign in with a passkey through form
  autofill](https://web.dev/articles/passkey-form-autofill) (web.dev)
- **Guide:** [Server-side passkey
  authentication](https://developers.google.com/identity/passkeys/developer-guides/server-authentication)
  (Google Developers)
- **Codelab:** [Implement passkeys with form autofill in a web
  app](https://goo.gle/passkeys-codelab) (Google Developers)
