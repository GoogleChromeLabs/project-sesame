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
[WebAuthn API](https://www.w3.org/TR/webauthn/), you need to configure the
sign-in experience and verify the authentication response on your server.

- **Enable conditional mediation:** Pass `mediation: 'conditional'` as an option
  to the `navigator.credentials.get()` call when initiating the passkey sign-in
  request.
- **Configure form autocomplete:** The username `<input>` element must include
  `webauthn` in its `autocomplete` attribute (e.g.,
  `autocomplete="username webauthn"`).
- **Verify the authentication response:** Send the returned credential to your
  server for verification before signing the user in.
- **Abort controller setup:** Use an `AbortController` to cancel any outstanding
  Conditional UI request before initiating a new WebAuthn call or navigating
  away from the page.

### Best practices & advanced UX

Consider these patterns to improve the passkey experience:

- **Orphaned credential cleanup:** Use the WebAuthn Signal API's
  [`PublicKeyCredential.signalUnknownCredential()`](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-that-a-credential-does-not-exist)
  to notify the browser when a passkey's matching public key is not found on the
  server, allowing the browser to delete the invalid credential.
- **Proactive passkey creation:** Prompt users to create a passkey immediately
  after they successfully sign in using a traditional password.
- **Automatic passkey creation:** Use
  [conditional creation](https://developer.chrome.com/docs/identity/webauthn-conditional-create)
  to automatically create a passkey after they sign in using a password and a
  second factor.
- **Local passkey creation:** After a successful sign-in using a cross-device
  passkey (e.g., scanning a QR code with a phone), prompt the user to
  [create a new passkey](https://web.dev/articles/passkey-form-autofill#encourage_creating_a_new_passkey_after_a_cross-device_authentication)
  on the current device for faster future sign-ins.
- **Synchronize credential state:** After a user signs in, use the WebAuthn
  Signal API to
  [signal the list of active passkeys](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-a-list-of-saved-credentials),
  which keeps the credentials stored in the browser synchronized with your
  application.

### Developer resources

- **Guide:** [Sign in with a passkey through form
  autofill](https://web.dev/articles/passkey-form-autofill) (web.dev)
- **Guide:** [Server-side passkey
  authentication](https://developers.google.com/identity/passkeys/developer-guides/server-authentication)
  (Google Developers)
- **Codelab:** [Implement passkeys with form autofill in a web
  app](https://goo.gle/passkeys-codelab) (Google Developers)
