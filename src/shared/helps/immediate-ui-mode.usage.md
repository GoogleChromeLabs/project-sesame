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
platform feature that lets users sign in at the point where they need an
account, without leaving the page. On this page, anyone can browse the product
catalog, but saving an item to favorites requires an account. When a signed-out
user clicks a favorite (heart) button, the browser immediately displays an
account picker listing all saved passwords and passkeys for this website.
After the user picks an account, they're signed in and the item is saved.

Unlike the standard passkey prompt, immediate UI mode fails fast. If the user
cancels the account picker or verification prompt, or no matching credentials
are found, the API throws an exception right away instead of falling back to a
QR code or external security key dialog. In these cases, or if your browser
doesn't support immediate UI mode, this demo redirects you to the standard
sign-in page.

To learn about design and UX best practices for this kind of sign-in, see the
[quick sign-ins UX guide](https://developer.chrome.com/docs/identity/ux-quick-signins).

### Prerequisites

- **Chromium-based browser:** Make sure your browser supports immediate UI
  mode.
- **Saved password or passkey:** You need at least one saved for this website
  in your password manager. If you don't have one yet, select
  **Create account** from the avatar menu in the top-right corner, or use the
  [sign-up form](/signup-form?r=/immediate-ui-mode). Then sign out from the
  avatar menu.

### How to test it

1. **Click a favorite button while signed out:** Click the heart icon on any
   product card. The account picker opens immediately.
2. **Select your account:** Choose a saved passkey or password from the picker
   and complete verification if prompted. You're signed in on the same page,
   your avatar appears in the top-right corner, and the item is added to your
   favorites.
3. **Sign out from the avatar menu:** Click your avatar in the top-right corner
   and select **Sign out** to return to the signed-out state.
