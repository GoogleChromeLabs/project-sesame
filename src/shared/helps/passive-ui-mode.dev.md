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

## Integrating passive UI mode (Conditional UI without autofill)

To integrate **passive UI mode** ([Conditional UI without
Autofill](https://github.com/w3c/webauthn/blob/main/explainers/conditional-ui-without-autofill.md))
on content pages where authentication is optional and no login form is
displayed, your application can check for the client capability
(`conditionalPassive` in the W3C explainer, or `ambientGet` in current Chrome
prototypes) and invoke a passive, conditional credential request on page
load—while pairing it with [Immediate UI mode](/immediate-ui-mode) when the user
performs an account-gated action.

### Implementation requirements

- **Client-side feature detection:** Check that `PublicKeyCredential` is
  available and call `await PublicKeyCredential.getClientCapabilities()` to
  verify `capabilities?.conditionalPassive` (or `capabilities?.ambientGet`) is
  `true` before starting the passive request.
- **Unified passive credential request:** Call `navigator.credentials.get()` on
  page load with `mediation: 'conditional'`, `uiMode: 'passive'`, `publicKey`
  request options (with `allowCredentials: []`), and optionally `password: true`:

```javascript
const capabilities = await PublicKeyCredential.getClientCapabilities();
if (capabilities?.conditionalPassive || capabilities?.ambientGet) {
  const cred = await navigator.credentials.get({
    publicKey: options,
    password: true,
    mediation: 'conditional',
    uiMode: 'passive',
    signal: controller.signal,
  });
}
```

- **Combine with Immediate UI mode via `AbortController`:** Because a passive
  request remains pending until the user interacts with the non-intrusive
  prompt, pass an `AbortController` `signal` to `navigator.credentials.get()`.
  If the user ignores the passive prompt and clicks an account-gated button
  (such as the favorite heart button), abort the pending passive request and
  invoke `navigator.credentials.get({ ..., uiMode: 'immediate' })` inside the
  click handler to show the active account picker modal (or fall back to a
  sign-in page if unsupported).
- **In-place completion:** When either the passive or immediate promise resolves
  with a `PublicKeyCredential` or `PasswordCredential`, verify it with your
  backend and update the page UI in place without a full page reload.

### Benefits & use cases

- **Frictionless sign-in on browsing pages:** Let returning users sign in from
  product catalogs, articles, or landing pages without navigating to a dedicated
  sign-in page or focusing an `<input>` element.
- **Non-intrusive UX:** The prompt appears quietly in the browser's omnibox or
  top-right corner only when the user actually has saved credentials for your
  relying party, avoiding modal interruptions for new visitors.
- **Progressive escalation from passive to active UI:** Combining Passive UI
  mode on page load (`uiMode: 'passive'`) with [Immediate UI
  mode](/immediate-ui-mode) on user gesture (`uiMode: 'immediate'`) provides a
  natural two-stage journey: passive awareness while browsing, and immediate
  contextual sign-in when taking action.

### Developer resources

- **Explainer:** [Conditional UI without Autofill](https://github.com/w3c/webauthn/blob/main/explainers/conditional-ui-without-autofill.md) (W3C WebAuthn)
- **Guide:** [Simpler WebAuthn feature detection](https://web.dev/articles/webauthn-client-capabilities) (web.dev)
- **Guide:** [Immediate UI mode for logins](https://developer.chrome.com/docs/identity/immediate-ui-mode) (Chrome Developers)
- **Guide:** [Quick sign-ins UX guide](https://developer.chrome.com/docs/identity/ux-quick-signins) (Chrome Developers)
