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

## Password change

On this page, you can experience a secure password update flow. To protect user
accounts, accessing this page requires a recent active session.

### How to test it:

- **Enter your new password**: Type a new password into the **New password**
  field, or a create a new password using your password manager.
- **Confirm the password**: Re-enter the identical password in the **Confirm
  password** field to ensure accuracy.
- **Update your password**: Click **Change password** to submit the form. A
  toast message will confirm the change, and you will be redirected to the home
  page.

### Reauthentication security:

You might have seen this page was protected by reauthentication, if you spent
more than 3 minutes after you signed in. If a set duration has elapsed since
your last sign-in or verification, the system will prompt you to verify your
identity before allowing access to this page. This prevents unauthorized
password changes if a user's session is left unattended on a shared device.

### Demo simulation:

Because this is a developer demo, the password is not stored on the server or
persisted to the database. The form successfully validates and simulates a
production-ready password update flow without modifying any real backend
credentials.
