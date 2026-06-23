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

## Integrating Passkey Reauthentication

To secure high-risk actions (such as updating account details or initiating
sensitive transactions), you can implement **passkey reauthentication** (also
known as step-up authentication) using the [WebAuthn
API](https://www.w3.org/TR/webauthn/).

While the implementation is similar to a standard passkey sign-in flow,
reauthentication requires strict constraints to ensure that the currently
signed-in user is verifying themselves, rather than another user signing in.

### Implementation Best Practices Checklist

To implement a secure and robust passkey reauthentication flow, follow these
critical guidelines:

- **Restrict Eligible Credentials:** Populate the
  [`allowCredentials`](https://web.dev/articles/webauthn-discoverable-credentials#allow-credentials)
  array in the `PublicKeyCredentialRequestOptions` passed to
  `navigator.credentials.get()`. This array must contain only the credential IDs
  associated with the currently signed-in user's account, preventing them from
  accidentally or maliciously verifying with a different user's passkey.
- **Match Server-Side Session:** On the server, strictly verify that the
  credential ID and user ID returned in the WebAuthn assertion match the
  credentials registered to the currently authenticated session user. This
  prevents token injection or credential substitution attacks.
- **Manage Reauth Expiry:** Store a timestamp of the successful reauthentication
  in the user's session. Treat the reauthenticated state as valid only for a
  short window (e.g., 5 to 15 minutes) before requiring another verification for
  subsequent sensitive actions.

### Developer Resources

- **Codelab:** [Build your first WebAuthn
  app](https://developers.google.com/codelabs/webauthn-reauth) (Google
  Developers)
