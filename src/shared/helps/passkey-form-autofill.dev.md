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

## Integrating Passkey Form Autofill

To build a seamless sign-in experience, you can integrate **passkey form autofill** (also known as Conditional UI) using the [WebAuthn API](https://www.w3.org/TR/webauthn/).

You can enable this by passing `mediation: 'conditional'` as an option to the `navigator.credentials.get()` call when initiating passkey authentication. Additionally, the corresponding username/password `<input>` element must include `webauthn` in its `autocomplete` attribute (e.g., `autocomplete="username webauthn"`).

### Best Practices & Advanced UX Checklist

To deliver a top-tier passkey experience, consider implementing these advanced patterns and API integrations:

- **Seamless Sign-In:** Enable users to [sign in with a passkey directly via form autofill](https://web.dev/articles/passkey-form-autofill) to reduce friction.
- **Orphaned Credential Cleanup:** Use the WebAuthn Signal API's [`PublicKeyCredential.signalUnknownCredential()`](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-that-a-credential-does-not-exist) to notify the browser when a passkey's matching public key is not found on the server, allowing the browser to delete the invalid credential.
- **Proactive Passkey Creation:** Prompt users to create a passkey immediately after they successfully sign in using a traditional password.
- **Seamless Passkey Creation (Conditional Create):** Use [conditional creation](https://developer.chrome.com/docs/identity/webauthn-conditional-create) to automatically prompt the user to create a passkey after they sign in using a password and a second factor.
- **Encourage Local Passkeys:** If a user signs in using a cross-device passkey (e.g., scanning a QR code with their phone), [prompt them to create a local passkey](https://web.dev/articles/passkey-form-autofill#encourage_creating_a_new_passkey_after_a_cross-device_authentication) on their current device for faster future logins.
- **Synchronize Credential State:** Use the WebAuthn Signal API to [signal the list of active passkeys](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-a-list-of-saved-credentials) or [update user details (such as username and display name)](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-updated-username-and-display-name) in the browser's credential manager after a successful sign-in.

### Developer Resources

- **Guide:** [Sign in with a passkey through form autofill](https://web.dev/articles/passkey-form-autofill) (web.dev)
- **Guide:** [Server-side passkey authentication](https://developers.google.com/identity/passkeys/developer-guides/server-authentication) (Google Developers)
- **Codelab:** [Implement passkeys with form autofill in a web app](https://goo.gle/passkeys-codelab) (Hands-on tutorial)
