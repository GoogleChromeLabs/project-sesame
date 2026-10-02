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

## Quick sign-in (Immediate UI mode)

[Immediate UI
mode](https://developer.chrome.com/docs/identity/immediate-ui-mode) is a web
platform capability designed to streamline contextual sign-in experiences. On
this page, anyone can browse the product catalog, but saving an item to
favorites requires an account. When a signed-out user clicks a favorite (heart)
button, the browser immediately displays a native account picker aggregating all
saved passwords and passkeys for this website, signing the user in and saving
the item without leaving the page.

Unlike the standard passkey prompt, immediate UI mode fails fast. If a user
cancels the verification prompt, if no matching credentials are found, or if the
browser does not support immediate UI mode, the API throws an exception
immediately without falling back to a QR code or external security key dialog,
and this demo redirects you to the standard sign-in screen.

For design recommendations and UX best practices for contextual authentication,
see the [quick sign-ins UX
guide](https://developer.chrome.com/docs/identity/ux-quick-signins).

### How to test it:

- **Browser prerequisite:** Ensure you are using a Chromium-based browser that
  supports immediate UI mode.
- **Save test credentials:** Make sure you have at least one account with a
  password or passkey saved in your password manager for this demo website. If
  you do not have any saved credentials yet, visit the [sign-up
  form](/signup-form) page to create an account, sign out, and return here.
- **Click a favorite button while signed out:** Click the heart icon on any
  product card to launch the unified credential picker immediately.
- **Select your account:** Choose a saved passkey or password from the native
  dialog and complete verification if prompted. You will be signed in in place,
  your avatar will appear in the top-right corner, and the item will be added to
  your favorites.
- **Sign out from the avatar menu:** Click your avatar in the top-right corner
  and select **Sign out** to return to the signed-out state.
