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

## Integrating FedCM delegation

To streamline user onboarding, you can use the [Federated Credential Management (FedCM) API](https://developer.chrome.com/docs/identity/fedcm) to request user identity attributes (such as name, email, and profile picture) directly from an Identity Provider (IdP) using Verifiable Credentials.

### Implementation guide

To request delegated identity attributes, invoke `navigator.credentials.get()` with `mediation: 'conditional'` and specify the required fields and credential format:

```javascript
const credential = await navigator.credentials.get({
  identity: {
    providers: [
      {
        format: 'vc+sd-jwt',
        configURL: 'https://idp.example/fedcm.json',
        clientId: 'YOUR_CLIENT_ID',
        fields: ['name', 'email', 'picture'],
      },
    ],
  },
  mediation: 'conditional',
});
```

To enable autofill integration, include `webidentity` in the input's `autocomplete` attribute:

```html
<input type="text" name="username" autocomplete="email webidentity" />
```

### Best practices checklist

When implementing FedCM delegation, follow these best practices:

- **Request minimal necessary fields:** Only request the specific identity fields required for account creation (such as `name` and `email`) to minimize data collection and respect user privacy.
- **Verify Verifiable Credentials on the backend:** Cryptographically verify the returned SD-JWT (Selective Disclosure JWT) credential on your server to confirm its authenticity, issuer signature, and audience before creating the account.
- **Combine with conditional mediation:** Use `mediation: 'conditional'` alongside `<input autocomplete="email webidentity">` so returning or onboarded users can select their identity provider seamlessly from browser autofill suggestions.
- **Provide a traditional fallback:** Always allow users to manually type their registration details if they prefer not to use a federated identity provider or if their browser does not support `IdentityCredential`.

### Developer resources

- **Guide:** [FedCM delegation and verifiable credentials](https://developer.chrome.com/docs/identity/fedcm) (Chrome Developer)
- **Specification:** [Federated Credential Management API](https://w3c-fedid.github.io/FedCM/) (W3C)
