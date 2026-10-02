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

## Integrating passkey reauthentication

To secure high-risk actions (such as updating account settings, changing credentials, or performing financial transactions), you can implement **passkey reauthentication** (also known as step-up authentication) using the [WebAuthn API](https://www.w3.org/TR/webauthn/).

While reauthentication uses `navigator.credentials.get()` similar to standard sign-in, it requires specific constraints to verify that the currently signed-in user—and not another person—is providing verification.

### Implementation best practices checklist

When implementing passkey reauthentication, follow these critical guidelines:

- **Restrict eligible credentials:** In the `PublicKeyCredentialRequestOptions` passed to `navigator.credentials.get()`, populate the `allowCredentials` array strictly with credential IDs belonging to the currently signed-in user. This prevents another user from accidentally or intentionally authenticating with an unrelated passkey on a shared device.
- **Enforce user verification:** Set `userVerification: 'required'` in the authentication options to guarantee that the authenticator performs biometric or device PIN verification, rather than merely verifying physical presence (`UP`).
- **Validate server-side session binding:** On the server, strictly verify that the returned credential ID and user handle match the user associated with the active session. Never allow a reauthentication response to switch or overwrite the existing session user.
- **Manage reauthentication validity window:** Record a timestamp upon successful reauthentication and verify it before executing sensitive actions. Treat the reauthenticated state as valid only for a short time window (e.g., 5 to 15 minutes) before requiring re-verification.
- **Provide graceful password fallback:** Provide an explicit option for users who cannot access their passkey to verify with their password or another registered secondary credential.

### Developer resources

- **Guide:** [Sign in with a passkey through form autofill](https://web.dev/articles/passkey-form-autofill) (web.dev)
- **Codelab:** [Build your first WebAuthn app](https://developers.google.com/codelabs/webauthn-reauth) (Google Developers)
- **Specification:** [Web Authentication: An API for accessing Public Key Credentials - Level 3](https://www.w3.org/TR/webauthn-3/) (W3C)
