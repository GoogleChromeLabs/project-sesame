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

To create a frictionless, zero-click sign-in experience for returning users, you can integrate the [Federated Credential Management (FedCM) API](https://developer.chrome.com/docs/identity/fedcm) in **passive mode**.

In passive mode, the browser attempts to display the identity provider (IdP) prompt immediately upon page load without requiring an explicit user gesture.

### Implementation guide

Passive mode is the default mode in FedCM. To initiate it, call `navigator.credentials.get()` with an `identity` configuration object:

```javascript
const credential = await navigator.credentials.get({
  identity: {
    providers: [
      {
        configURL: 'https://idp.example/fedcm.json',
        clientId: 'YOUR_CLIENT_ID',
      },
    ],
  },
  mediation: 'optional',
});
```

### Best practices checklist

When implementing FedCM passive mode, follow these best practices:

- **Graceful degradation:** Always provide an explicit sign-in fallback (such as standard buttons or username/password fields) if the browser does not support `IdentityCredential`, if the passive request fails, or if the user is not currently signed in to the IdP.
- **Server-side credential verification:** Send the returned credential token to your backend for cryptographic verification. Because FedCM is protocol-agnostic, verification depends on the token format (for example, validating an OpenID Connect JWT against the IdP's JSON Web Key Set).
- **Mediation control:** Choose the appropriate `mediation` setting (`'optional'`, `'required'`, `'silent'`, or `'conditional'`). In passive mode, `'optional'` (the default) is recommended for sign-in pages to enable auto-reauthentication, whereas `'required'` forces explicit user confirmation every time.
- **Respect IdP login status:** Ensure the IdP implements the [Login Status API](https://developer.chrome.com/docs/identity/fedcm/implement/identity-provider#login-status-api). If the browser knows the user is logged out of the IdP, it suppresses the passive prompt without making unnecessary network requests.

### Developer resources

- **Guide:** [Implement an identity solution with FedCM on the Relying Party side](https://developer.chrome.com/docs/identity/fedcm/implement/relying-party) (Chrome Developer)
- **Guide:** [Implement an identity solution with FedCM on the Identity Provider side](https://developer.chrome.com/docs/identity/fedcm/implement/identity-provider) (Chrome Developer)
- **API Reference:** [Federated Credential Management API](https://developer.mozilla.org/en-US/docs/Web/API/FedCM_API) (MDN)
