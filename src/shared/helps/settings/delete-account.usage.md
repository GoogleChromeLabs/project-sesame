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

## Deleting your account

On this page, you can delete your account and clean up all associated authentication credentials.

### How account deletion works

When you delete an account on Project Sesame, the application performs a cascading deletion:

- All server-side user data and credentials are removed.
- The WebAuthn [Signal API](https://developer.chrome.com/docs/identity/webauthn-signal-api) notifies the browser's password manager to remove all passkeys associated with the account.
- The active session is destroyed and you are signed out.

### How to test it

- **Initiate account deletion:** Click the **Delete account** button.
- **Confirm deletion:** A confirmation dialog appears asking you to confirm. Click **OK** to proceed.
- **Observe passkey cleanup:** The browser triggers the WebAuthn Signal API (`PublicKeyCredential.signalAllAcceptedCredentials()`) to signal that no valid passkeys remain for this user, prompting supporting password managers to delete the local passkeys.
- **Automatic sign-out:** Once cleanup completes, a notification appears and you are redirected to the home page in a signed-out state.
