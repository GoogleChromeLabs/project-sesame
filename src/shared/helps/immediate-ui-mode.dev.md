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

To integrate
[**immediate UI mode**](https://developer.chrome.com/docs/identity/immediate-ui-mode)
for contextual sign-in (such as saving an item to favorites without leaving the
page), you need to check browser support, request passwords and passkeys in a
single `navigator.credentials.get()` call, and fall back to a standard sign-in
page when the call fails.

### Implementation requirements

- **Use feature detection:** Check that the browser supports
  [`PasswordCredential`](https://web.dev/articles/security-credential-management-retrieve-credentials),
  `PublicKeyCredential`, and the
  [`immediateGet` client capability](https://web.dev/articles/webauthn-client-capabilities)
  before you start the flow.
- **Request passwords and passkeys together:** Pass `password: true` and
  `publicKey` options in a single `navigator.credentials.get()` call.
- **Set immediate UI mode in a user gesture:** Pass `uiMode: 'immediate'` from
  a user gesture handler (such as a click on a favorite button). The browser
  then shows a native account picker straight away.
- **Complete the action in place:** After you verify the credential, update the
  page to the signed-in state and finish the user's action.
- **Fall back when the call fails:** The call throws a `NotAllowedError` if no
  matching credentials are saved or the user dismisses the picker. When this
  happens, or the browser doesn't support the feature, redirect to a standard
  sign-in page (such as [passkey form autofill](/passkey-form-autofill)). See
  the
  [quick sign-ins UX guide](https://developer.chrome.com/docs/identity/ux-quick-signins)
  for recommended fallback flows.

### Benefits & use cases

- **Sign in without leaving the page:** Users sign in when they use an
  account-gated feature (such as saving an item to favorites), and their action
  completes right away.
- **Passwords and passkeys in one picker:** The browser shows all the
  credentials saved in the user's password manager in a single native dialog.
- **Fast fallback:** Unlike standard WebAuthn prompts, immediate UI mode doesn't
  offer security keys or QR code scanning. If no matching credentials are
  saved or the user cancels, the call fails straight away, so you can show your
  fallback.

### Developer resources

- **Guide:** [Immediate UI mode for
  logins](https://developer.chrome.com/docs/identity/immediate-ui-mode)
  (Chrome for Developers)
- **Guide:** [Quick sign-ins UX
  guide](https://developer.chrome.com/docs/identity/ux-quick-signins)
  (Chrome for Developers)
- **Guide:** [Simpler WebAuthn feature
  detection](https://web.dev/articles/webauthn-client-capabilities) (web.dev)
- **Guide:** [Sign in
  Users](https://web.dev/articles/security-credential-management-retrieve-credentials)
  (web.dev)
