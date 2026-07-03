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

## Integrating immediate UI mode

To integrate [**immediate UI
mode**](https://developer.chrome.com/docs/identity/immediate-ui-mode) for
logins, your application must orchestrate client-side feature detection, request
both password and public key credentials in a unified
`navigator.credentials.get()` call, and handle fast-failing exceptions.

### Implementation requirements

- **Unified credential request:** Query both `password: true` and `publicKey`
  options within a single `navigator.credentials.get()` call.
- **Set immediate UI mode:** Pass the `uiMode: 'immediate'` parameter to tell
  the browser to display a native, unified account picker instantly.
- **Client-side feature detection:** Verify the browser supports
  `PasswordCredential`, `PublicKeyCredential`, and the `immediateGet` client
  capability before triggering the immediate UI flow.
- **Graceful fallback mechanism:** Since immediate UI mode fails fast without
  displaying external QR code or security key prompts, implement a fallback that
  reveals a traditional sign-in form or enables passkey form autofill if the API
  call fails or is unsupported.

### Benefits & use cases

- **Streamlined single-button sign-in:** Replace traditional, cluttered login
  screens (which require username/password fields and separate social/passkey
  buttons) with a single, prominent "Sign-in" button that invokes a native
  browser account picker.
- **Aggregated account picker:** Displays all credentials saved in the user's
  password manager—including both traditional passwords and modern passkeys—in a
  unified, browser-native dialog.
- **Fast, fail-safe execution:** Unlike standard WebAuthn prompts, immediate UI
  mode does not prompt users with security keys or QR code scanning. If no
  matching credentials are saved or if the user cancels, the API immediately
  throws an exception, allowing you to transition smoothly to fallback options.

### Developer resources

- **Guide:** [Simpler WebAuthn feature detection](https://web.dev/articles/webauthn-client-capabilities) (web.dev)
- **Guide:** [Immediate UI mode for logins](https://developer.chrome.com/docs/identity/immediate-ui-mode) (Chrome Developers)
- **Guide:** [Sign in Users (PasswordCredential)](https://web.dev/articles/security-credential-management-retrieve-credentials) (web.dev)
