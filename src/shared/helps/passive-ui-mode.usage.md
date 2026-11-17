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

## Ambient sign-in (Passive UI mode)

**Passive UI mode** (defined in the W3C WebAuthn explainer as [Conditional UI
without
Autofill](https://github.com/w3c/webauthn/blob/main/explainers/conditional-ui-without-autofill.md),
and also referred to as **Ambient UI** in Chrome experimental flags) is a
passive web platform capability designed for pages where signing in is
optional—such as this product catalog—and no username input field is present.
When a signed-out user visits the page and already has saved passkeys or
passwords for this website, the browser displays a non-intrusive sign-in prompt
(such as an omnibox suggestion or top-right bubble) without interrupting
browsing.

Passive UI mode is triggered automatically on page load using
`mediation: 'conditional'` and `uiMode: 'passive'`. If no matching credentials
exist on the device, the browser remains silent and displays no UI.

If the user ignores or dismisses the passive prompt (or if the feature is not
enabled in the browser) and then clicks a **favorite (heart) button** while
signed out, this page smoothly falls back to [Quick sign-in (Immediate UI
mode)](/immediate-ui-mode) (`uiMode: 'immediate'`), canceling the pending
passive request and displaying an active account picker modal right when the
user tries to save an item.

### Prerequisites

- **Browser & Chrome flags (`chrome://flags`):**
  - **Chrome 149 or higher:** Enable
    `chrome://flags/#web-authentication-ambient-signin`
    (`#web-authentication-immediate-get` is enabled by default).
  - **Chrome 148 or lower:** Enable both
    `chrome://flags/#web-authentication-immediate-get` and
    `chrome://flags/#web-authentication-ambient-signin` (Immediate Get is
    required because Passive UI mode uses the `uiMode` field).
  - **Chrome 150 UI option:** To test the anchored message UI for single
    credentials, set `chrome://flags/#web-authentication-ambient-signin` to
    **Enabled Anchored Message**.
  - Restart the browser after changing flags.
- **Saved credentials:** Make sure you have at least one account with a
  password or passkey saved in your password manager for this demo website. If
  you do not have any saved credentials yet, select **Create account** from the
  avatar menu in the top-right corner (or visit the [sign-up
  form](/signup-form?r=/passive-ui-mode) page) to create an account, then sign
  out from the avatar menu.

### How to test it

- **Observe the Passive UI prompt on page load:** When this page loads while
  signed out:
  - In **Chrome 149+**, a single available credential appears as a suggestion in
    the **omnibox (address bar)** (or as an anchored message in Chrome 150),
    while multiple credentials appear in a top-right bubble.
  - In **Chrome 148**, available credentials appear in a top-right bubble
    similar to FedCM.
- **Sign in via Passive UI or via the favorite button:**
  - **Passive sign-in (on page load):** Select your saved passkey or password
    from the browser's non-intrusive prompt. You will be signed in in place and
    your avatar will appear in the top-right corner.
  - **Contextual fallback (Immediate UI on click):** If you dismiss or skip the
    passive prompt and click a product's **heart icon** while signed out, the
    page triggers Immediate UI mode to sign you in and add the item to your
    favorites in place (or redirects to the standard sign-in form if no
    credentials are available).
- **Sign out from the avatar menu:** Click your avatar in the top-right corner
  and select **Sign out** to return to the signed-out state.
