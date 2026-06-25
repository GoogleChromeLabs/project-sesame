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

## Integrating FedCM active mode

To implement a user-initiated federated sign-in flow, you can use FedCM's
**active mode**. This mode is designed for scenarios where the authentication
request is triggered by an explicit user gesture, such as clicking a "Sign-in"
button.

### Implementation Guide

In active mode, you call `navigator.credentials.get()` and specify `mode:
'active'` within the `identity` options. Because active mode requires user
intent, this call must be executed within a user gesture handler (e.g., a button
click event listener).

### Best practices checklist

When implementing FedCM active mode, follow the best practices:

- **Graceful degradation:** Always implement a fallback mechanism (such as
  showing standard sign-in buttons) in case the browser does not support
  `IdentityCredential` or the passive request is rejected.
- **User gesture requirement:** Ensure that `navigator.credentials.get()` with
  `mode: 'active'` is invoked directly inside a user interaction handler (like a
  `click` event). If called without a user gesture, the browser will reject the
  request.
- **Credential verification:** Ensure the returned credential is sent to the
  backend and verified. Note that as FedCM is protocol agnostic, follow the
  IdP's instructions on how to verify the credential. If it is built on OpenID
  Connect, the credential is typically an ID token that can be verified against
  the IdP's public key.
- **Provide clear entry points:** Clearly label button UI (e.g., "Sign-in with
  _IdP_") so the user understands that clicking the button will initiate a
  federated login flow.

### Developer Resources

- **Guide:** [Implement an identity solution with FedCM on the Relying Party side](https://developer.chrome.com/docs/identity/fedcm/implement/relying-party) (Chrome Developer)
- **Guide:** [Implement an identity solution with FedCM on the Identity Provider side](https://developer.chrome.com/docs/identity/fedcm/implement/identity-provider) (Chrome Developer)
