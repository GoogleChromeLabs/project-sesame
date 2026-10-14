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

This page demonstrates **automatic passkey creation** (also known as
Conditional Create), which creates a passkey for you right after you sign in
with a saved password. You get a passkey without having to set one up from a
settings page.

### Prerequisites

To see a passkey created, you need:

- A Chromium-based browser or Apple Safari.
- A password for this site saved in your browser's password manager.
- No existing passkey for this account in that password manager.

### How to test it

1. **Save a password first:** Select **Register now** to create an account,
   and make sure the password is saved to your browser's password manager. If
   you already have a saved password, skip this step.
2. **Sign out:** If you're signed in, select **Sign out** in the sidebar and
   return to this page.
3. **Sign in with your saved password:** Select the username field, choose
   your saved account from the autofill suggestions, then select **Login**.
4. **Trigger the passkey upgrade:** After you sign in, the password manager
   creates a passkey for this account in the background.
5. **Find the confirmation:** Your browser shows a notification when the
   passkey is created. You can also open **Passkey Management** to see the new
   passkey listed.

\* _The password manager only creates a passkey when the password you enter
matches the one it has saved and the account doesn't already have a passkey.
However, the demo signs you in with any password, so you're still signed in
even when no passkey is created._
