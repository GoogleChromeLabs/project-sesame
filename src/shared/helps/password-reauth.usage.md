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

## Password reauthentication

On this page, you can experience and learn how password-based reauthentication
protects sensitive user actions.

You were redirected here because you tried to access a sensitive settings page
(such as password change or account deletion) after your initial sign-in session
aged past the active threshold.

### How to test it:

- **Enter your password**: Type a password in the **password** field.
- **Verify your identity**: Click **Verify** to submit the form and confirm your
  credential.
- **Use a passkey instead**: If you have registered a passkey for your account,
  click **Verify with a passkey instead** to experience passkey-based
  reauthentication, which is more secure.

### Reauthentication security:

Reauthentication is a security pattern that prompts signed-in users to re-verify
their credential before performing critical actions. This prevents unauthorized
actions if the user's session cookie is stolen or the user leaves their device
unattended.

### Demo simulation:

Because this is a developer demo, your password is not saved or validated on the
server. You can enter any random text as your password, and the system will
simulate a successful reauthentication ceremony, elevate your session status,
and redirect you back to your original destination.
