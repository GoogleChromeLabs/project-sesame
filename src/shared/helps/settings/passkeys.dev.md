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

## Integrating passkey management & registration

To support passkey management and registration, your application must implement
sophisticated passkey management UX and secure backend.

---

### Passkey management requirements

A comprehensive passkey management interface gives users visibility and control over their registered credentials.

#### Technical checklist for passkey management

To build an optimal, secure, and modern passkey management experience, implement the following key capabilities and API patterns:

- **Multiple passkeys support:** Allow users to register and manage multiple
  passkeys. This provides redundancies across different passkey providers and
  security keys.
- **In-context registration:** Enable users to register a new passkey directly
  from their passkey management page.
- **Informative metadata display:** Display clear, helpful metadata for each
  credential to help users easily identify and distinguish their keys:
  - **Credential name:** Assign a passkey provider name (e.g., Google Password
    Manager, iCloud Keychain, Windows Hello) mapped with the
    [AAGUID](https://web.dev/articles/webauthn-aaguid) at the registration or
    allow the user to edit it to a custome name.
  - **Passkey provider icon:** Use a passkey provider icon mapped with the
    AAGUID.
  - **Sync state indicator:** Use the `credentialBackedUp` flag stored on the
    server to indicate whether a passkey is backed up and synchronized across
    devices (multi-device) or locked to a single physical device
    (single-device).
  - **Usage timestamps:** Show the registration date and the last used timestamp
    (updated upon successful authentication).
- **Secure credential revocation:** Provide an intuitive way to delete a
  credential. Deleting a passkey must remove its public key from the server's
  database, immediately revoking its access.
- **Credential state synchronization (Signal API):** To mitigate orphaned
  passkeys and user confusion, keep the server's active credential list and the
  browser's passkey provider in sync using the [WebAuthn Signal API
  `PublicKeyCredential.signalAllAcceptedCredentials()`](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-a-list-of-saved-credentials).
  Pass in the updated list of accepted credential IDs for the user when a
  passkey is added or removed. This automatically evicts deleted credentials
  from the user's passkey provider, preventing orphaned passkeys.
- **User name synchronization:** When the username or the display name is
  updated on the website, passkeys displayed in the passkey list upon
  authentication is ideal. [Signal the passkey
  provider](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-updated-username-and-display-name)
  to update user details in the browser's passkey provider.

### Passkey registration

Before prompting a user to create a passkey, reauthenticate the user with the
email address or the phone number, instead of a password or a passkey. Because
if the attacker already knows the password and created a passkey, they can
create another passkey and continue hijacking the account. By reauthenticating
via a communication channel, the user has at least a chance to notice someone is
about to create a new passkey.

\* In this demo, we only check if the user owns a credential due to technical
limitations.

#### Best practices

To register a passkey, the client-side application orchestrates the following steps:

- **Prevent duplicate credentials:** Use the
  [`excludeCredentials`](https://web.dev/articles/webauthn-exclude-credentials)
  parameter when requesting registration options from the server. This ensures
  users cannot register the same passkey provider twice for the same account,
  keeping their credentials list clean.
- **Store metadata:** Persist the credential's public key, ID, transport
  methods, device type (`credentialDeviceType`), and sync status
  (`credentialBackedUp` flag) in the database.
- **Save the AAGUID to identify the passkey provider:** Extract
  [AAGUID](https://web.dev/articles/webauthn-aaguid) from the credential, so
  that you can identify the passkey provider (e.g., Google Password Manager,
  iCloud Keychain, Windows Hello) and display the name and its icon to the user
  in the passkey management page..
- **Clean unverified passkey:** If the server-side verification fails after the
  passkey is created, call [the WebAuthn Signal API's
  `PublicKeyCredential.signalUnknownCredential()`](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-that-a-credential-does-not-exist)
  to notify the passkey provider to evict the invalid credential.
- **Notify the user:** Send a notification to the user after creating and
  registering a passkey for their account. This helps users detect unauthorized
  account access.

### Developer resources

- **Guide:** [Help users manage passkeys effectively](https://web.dev/articles/passkey-management) (web.dev)
- **Guide:** [Create a passkey for passwordless logins](https://web.dev/articles/passkey-registration) (web.dev)
- **Guide:** [Server-side passkey registration](https://developers.google.com/identity/passkeys/developer-guides/server-registration)
- **API Reference:** [WebAuthn Signal API](https://developer.chrome.com/docs/identity/webauthn-signal-api) (Chrome Developers)
