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
contextual logins (such as saving an item to favorites without leaving the
page), your application must orchestrate client-side feature detection, request
both password and public key credentials in a unified
`navigator.credentials.get()` call, and handle fast-failing exceptions.

### Implementation requirements

- **Unified credential request:** Query both `password: true` and `publicKey`
  options within a single `navigator.credentials.get()` call.
- **Set immediate UI mode:** Pass the `uiMode: 'immediate'` parameter inside a
  user gesture handler (such as clicking a favorite button) to tell the browser
  to display a native, unified account picker instantly.
- **Client-side feature detection:** Verify the browser supports
  [`PasswordCredential`](https://web.dev/articles/security-credential-management-retrieve-credentials),
  `PublicKeyCredential`, and the
  [`immediateGet` client capability](https://web.dev/articles/webauthn-client-capabilities)
  before triggering the immediate UI flow.
- **In-place completion & graceful fallback:** Once the credential is verified,
  update the signed-in UI in place and complete the user's action immediately.
  Since immediate UI mode fails fast with a `NotAllowedError` when no matching
  credentials exist or when the user dismisses the prompt, fall back by
  redirecting to a standard sign-in page (such as a [passkey form
  autofill](/passkey-form-autofill) screen) when the API call fails or is
  unsupported. Refer to the [quick sign-ins UX
  guide](https://developer.chrome.com/docs/identity/ux-quick-signins) for
  recommended fallback flows and journey design.

### Benefits & use cases

- **Contextual sign-in without page navigation:** Prompt users to sign in at the
  exact moment they interact with an account-gated feature (like "Save to
  favorites") and complete their action right away without redirecting to a
  separate login screen.
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
- **Guide:** [Quick sign-ins UX guide](https://developer.chrome.com/docs/identity/ux-quick-signins) (Chrome Developers)
- **Guide:** [Sign in Users (PasswordCredential)](https://web.dev/articles/security-credential-management-retrieve-credentials) (web.dev)
