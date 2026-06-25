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

## Integrating FedCM passive mode

To create a frictionless federated authentication flow, you can use FedCM's
**passive mode** to trigger the identity provider (IdP) prompt automatically
upon page load without requiring a direct user gesture.

### Implementation Guide

In passive mode, you call `navigator.credentials.get()` and specify `mode:
'passive'` within the `identity` options.

### Best practices checklist

When implementing FedCM passive mode, follow the best practices:

- **Graceful degradation:** Always implement a fallback mechanism (such as
  showing standard sign-in buttons) in case the browser does not support
  `IdentityCredential` or the passive request is rejected.
- **Credential verification:** Ensure the returned credential is sent to the
  backend and verified. Note that as FedCM is protocol agnostic, follow IdP's
  instructions how to verify the credential. If it's built based on OpenID
  Connect, the credential is typically and ID token so that you can verify
  against IdP's public key.
- **Mediation Control:** Use `mediation` option (such as `'required'` or
  `'optional'`) to balance user convenience and user control.

### Developer Resources

- **Guide:** [Implement an identity solution with FedCM on the Relying Party side](https://developer.chrome.com/docs/identity/fedcm/implement/relying-party) (Chrome Developer)
- **Guide:** [Implement an identity solution with FedCM on the Identity Provider side](https://developer.chrome.com/docs/identity/fedcm/implement/identity-provider) (Chrome Developer)
