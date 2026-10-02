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

## Integrating the legacy Credential Management API

The legacy Credential Management API allowed web applications to request stored password and federated identity credentials through a programmatic JavaScript interface.

### Implementation guide

To request legacy credentials, call `navigator.credentials.get()` specifying `password: true` or `federated` options:

```javascript
if (window.PasswordCredential) {
  const credential = await navigator.credentials.get({
    password: true,
    federated: {
      providers: ['https://accounts.google.com'],
    },
  });

  if (credential) {
    // Process PasswordCredential or FederatedCredential
  }
}
```

### Deprecation and migration checklist

When maintaining or updating authentication flows that rely on legacy credentials, follow these migration guidelines:

- **Browser deprecation status:** `PasswordCredential` and `FederatedCredential` are deprecated and disabled by default in modern Chromium browsers. Do not rely on them for new production deployments.
- **Migrate password flows to passkeys:** Replace `PasswordCredential` retrieval with [passkey form autofill](https://web.dev/articles/passkey-form-autofill) (WebAuthn Conditional UI) using `<input autocomplete="username webauthn">` and `navigator.credentials.get({ mediation: 'conditional' })`.
- **Migrate federated flows to FedCM:** Replace `FederatedCredential` with the [Federated Credential Management API (FedCM)](https://developer.chrome.com/docs/identity/fedcm) (`identity.providers`), which provides privacy-preserving third-party identity federation without third-party cookies.
- **Feature detection and graceful degradation:** Always gate legacy credential calls behind feature detection (`'PasswordCredential' in window`) and provide standard form or passkey fallbacks.

### Developer resources

- **Guide:** [Sign in with a passkey through form autofill](https://web.dev/articles/passkey-form-autofill) (web.dev)
- **Guide:** [Federated Credential Management API (FedCM)](https://developer.chrome.com/docs/identity/fedcm) (Chrome Developer)
- **Specification:** [Credential Management Level 1](https://www.w3.org/TR/credential-management-1/) (W3C)
