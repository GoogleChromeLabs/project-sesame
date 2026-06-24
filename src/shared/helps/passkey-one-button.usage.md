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

## Passkey Sign-in Button

On this page, you can experience a dedicated, one-click authentication flow
using a **Sign-in with a passkey** button. This flow simplifies the entry point
by prioritizing passkeys while maintaining a fallback path for users without
them. This page also demonstrates how the WebAuthn [Signal
API](https://developer.chrome.com/docs/identity/webauthn-signal-api) keeps the
browser's credential manager clean.

### How to test it:

1. **Click or tap the "Sign in with a passkey" button.**
2. Depending on whether you have a saved passkey for this site:
   - **If you have a saved passkey:** The browser's passkey verification prompt
     will appear immediately, allowing you to sign in with your biometric scan
     or screen lock.
   - **If you do NOT have a saved passkey:** The browser will display a QR code
     dialog, allowing you to scan it with your mobile device to sign in using a
     passkey stored there.

If you want to bypass the QR code dialog entirely, try [immediate UI mode](/immediate-ui-mode).

### WebAuthn Signal API Demo:

If a passkey sign-in attempt is rejected by the server because the corresponding
public key is not found (e.g., if the credential was deleted on the server but
still remains in the browser's password manager), the server uses the WebAuthn
Signal API to signal the browser. The browser will then delete the invalid
passkey from its credential manager, preventing future invalid sign-in attempts.
