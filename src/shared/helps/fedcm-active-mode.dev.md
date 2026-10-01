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

To implement an explicit, user-initiated federated login flow, you can integrate the [Federated Credential Management (FedCM) API](https://developer.chrome.com/docs/identity/fedcm) in **active mode**.

Unlike passive mode, active mode is designed for explicit user intent (such as clicking a "Sign in with IdP" button). It presents a prominent modal dialog and enables the browser to handle users who are not yet logged in to the identity provider (IdP).

### Implementation guide

To initiate active mode, call `navigator.credentials.get()` with `mode: 'active'` inside a user gesture event listener (such as a button click):

```javascript
button.addEventListener('click', async () => {
  const credential = await navigator.credentials.get({
    identity: {
      providers: [
        {
          configURL: 'https://idp.example/fedcm.json',
          clientId: 'YOUR_CLIENT_ID',
        },
      ],
      mode: 'active',
    },
  });
  // Send credential.token to the server for verification
});
```

### Best practices checklist

When implementing FedCM active mode, follow these best practices:

- **User gesture requirement:** Always invoke `navigator.credentials.get()` with `mode: 'active'` inside a direct user interaction handler (such as a `click` event). Calling active mode without a valid user activation will cause the browser to reject the request.
- **Signed-out IdP flow (login_url):** Take advantage of active mode's ability to handle signed-out users. When an IdP marks its status as logged-out or returns an empty accounts list, the browser can open the IdP's `login_url` in a secure popup window, allowing the user to sign in to the IdP and seamlessly continue the RP sign-in.
- **Graceful degradation:** Always provide an alternative sign-in fallback (such as a redirect-based OAuth flow or username/password sign-in) if the browser does not support `IdentityCredential` or if the user cancels the dialog.
- **Server-side credential verification:** Send the returned identity token to your backend and verify its cryptographic signature, audience (`aud`), issuer (`iss`), and expiration (`exp`) before creating an authenticated session.
- **Clear button labeling:** Clearly label the button UI (for example, "Sign in with IdP") so users understand that clicking it initiates a federated authentication flow.

### Developer resources

- **Guide:** [Implement an identity solution with FedCM on the Relying Party side](https://developer.chrome.com/docs/identity/fedcm/implement/relying-party) (Chrome Developer)
- **Guide:** [Implement an identity solution with FedCM on the Identity Provider side](https://developer.chrome.com/docs/identity/fedcm/implement/identity-provider) (Chrome Developer)
- **Guide:** [FedCM active mode and login status](https://developer.chrome.com/docs/identity/fedcm/active-mode) (Chrome Developer)
