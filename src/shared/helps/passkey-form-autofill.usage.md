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

## Passkey form autofill

In this page, you can experience authentication through a form that can
accommodate passkeys and passwords. We call it "passkey form autofill" flow. In
addition, WebAuthn Signal API deletes a passkey when it's unusable.

Put your cursor on the username field and form autofill suggestions should
appear. The list contains passkeys and passwords that are stored to the password
manager, so you can select one to proceed signing in.

If you haven't created a passkey on this website yet, you can enter an arbitrary
username and continue. You can enter a random password in the next page to
create an account. The password will be ignored.

If you do have entries in the password manager:

- Select a password entry, and associated username will be filled in the
  username field, so that you can **Continue** to enter a password.
- Select a passkey entry, and a passkey dialog will appear to proceed with
  user verification, and you'll be signed in.

If your sign-in attempt is rejected by the server because the public key is not
found on the server, the password manager will delete the passkey to avoid
further confusion. This is done by WebAuthn Signal API.
