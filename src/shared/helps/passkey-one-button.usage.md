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

## Passkey sign-in button

On this page, you can experience a dedicated, one-click authentication flow using a **Sign-in with a passkey** button. This flow simplifies the entry point by prioritizing passkeys while maintaining a fallback path for users without them. This page also demonstrates how the WebAuthn [Signal API](https://developer.chrome.com/docs/identity/webauthn-signal-api) keeps the browser's credential manager clean.

### How to test it

- **Click or tap the "Sign in with a passkey" button.**
- **If you have a saved passkey:** The browser's passkey verification prompt appears immediately, allowing you to sign in with your biometric scan or screen lock.
- **If you do not have a saved passkey:** The browser displays a QR code dialog, allowing you to scan it with your mobile device to sign in using a passkey stored there.

If you want to bypass the QR code dialog entirely, try [immediate UI mode](/immediate-ui-mode).

### How the Signal API handles invalid passkeys

A passkey can remain in your password manager even after you delete its corresponding credential from your account settings. If you try to sign in with that passkey, the server rejects the attempt because it can no longer find the matching public key.

The page then uses the WebAuthn Signal API to notify the passkey provider that the credential is no longer recognized. A supporting password manager can remove the invalid passkey so it is no longer offered for sign-in.
