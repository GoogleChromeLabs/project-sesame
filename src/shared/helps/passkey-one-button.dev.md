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

## Integrating a Passkey Sign-In Button

To build a dedicated, one-button passkey sign-in experience (the "one button"
flow), you can invoke the [WebAuthn API](https://www.w3.org/TR/webauthn/) by
calling `navigator.credentials.get()` with the appropriate public key request
options. Unlike conditional UI, this is typically triggered directly by a user
clicking a "**Sign in with a passkey**" button.

### Best Practices & Advanced UX Checklist

To deliver a top-tier passkey experience, consider implementing these advanced
patterns and API integrations:

- **Orphaned Credential Cleanup:** Use the WebAuthn Signal API's
  [`PublicKeyCredential.signalUnknownCredential()`](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-that-a-credential-does-not-exist)
  to notify the browser when a passkey's matching public key is not found on the
  server, allowing the browser to delete the invalid credential.
- **Encourage Local Passkeys:** If a user signs in using a cross-device passkey
  (e.g., scanning a QR code with their phone), [prompt them to create a local
  passkey](https://web.dev/articles/passkey-form-autofill#encourage_creating_a_new_passkey_after_a_cross-device_authentication)
  on their current device for faster future logins.
- **Synchronize Credential State:** Use the WebAuthn Signal API to [signal the
  list of active
  passkeys](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-a-list-of-saved-credentials)
  in the browser's credential manager after a successful sign-in.

### Developer Resources

- **Guide:** [Sign in with a passkey through form
  autofill](https://web.dev/articles/passkey-form-autofill) (web.dev)
- **Guide:** [Server-side passkey
  authentication](https://developers.google.com/identity/passkeys/developer-guides/server-authentication)
  (Google Developers)
- **Codelab:** [Implement passkeys with form autofill in a web
  app](https://goo.gle/passkeys-codelab) (Hands-on tutorial)
