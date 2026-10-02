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

## Integrating account deletion with passkey cleanup

When a user deletes their account, Relying Parties should not only delete the user record on the server, but also signal the client's passkey provider (password manager) to delete any remaining passkeys. This prevents orphaned passkeys from cluttering the user's password manager using the [WebAuthn Signal API](https://developer.chrome.com/docs/identity/webauthn-signal-api).

### Implementation guide

To clear all registered passkeys in the password manager when deleting an account, invoke `PublicKeyCredential.signalAllAcceptedCredentials()` with an empty `allAcceptedCredentialIds` array:

```javascript
if (window.PublicKeyCredential?.signalAllAcceptedCredentials) {
  await PublicKeyCredential.signalAllAcceptedCredentials({
    rpId: 'example.com',
    userId: base64UrlEncodedUserId,
    allAcceptedCredentialIds: [],
  });
}
```

### Best practices checklist

When implementing account deletion and passkey cleanup, follow these practices:

- **Signal all credential deletions:** Call `PublicKeyCredential.signalAllAcceptedCredentials()` with `allAcceptedCredentialIds: []` to tell the password manager that no valid passkeys remain for this account.
- **Cascade server-side deletions:** Delete all database entries associated with the user, including stored public keys, federation mappings, and session records, before removing the user document.
- **Destroy active sessions:** Destroy the server-side session and clear session cookies to ensure the user is completely signed out upon account deletion.
- **Feature detection:** Wrap the Signal API call in feature detection (`PublicKeyCredential?.signalAllAcceptedCredentials`) so browsers that do not yet support the Signal API complete the deletion flow without errors.

### Developer resources

- **Guide:** [Signal passkey state to passkey providers](https://developer.chrome.com/docs/identity/webauthn-signal-api) (Chrome Developer)
- **Specification:** [WebAuthn Signal API](https://w3c.github.io/webauthn/#sctn-signal-api) (W3C)
