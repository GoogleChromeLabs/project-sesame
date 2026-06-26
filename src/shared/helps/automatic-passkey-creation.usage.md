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

## Automatic passkey creation

On this page, you can experience a traditional form-based sign-in flow with
**automatic passkey creation** that helps you transition to passkeys.

### Prerequisites

- **Browser support**: Automatic passkey creation requires a Chromium based
  browser or Apple Safari.
- **Saved credentials**: You must have a saved password for this site in your
  browser's password manager in advance.
- **No existing passkeys**: The browser's password manager must not already
  contain a passkey for this account.

### How to test it:

- **Save a password first**: If you haven't already, sign up to this website (or
  sign in and save a password to your browser's password manager).
- **Sign in with your saved password**: Enter your saved username and matching
  password, then click **Login**.
- **Trigger the passkey upgrade**: Upon successful authentication, the browser
  will detect that the entered password matches the saved one and automatically
  create a new passkey.
- **Find the dialog**: You'll be notified when a passkey is successfully
  created.

\* To test this successfully, the password you enter must match a password
already saved in your browser's password manager for this site. The demo backend
accepts any password to log you in, but the browser's password manager requires
a matching saved password to trigger the passkey upgrade.
