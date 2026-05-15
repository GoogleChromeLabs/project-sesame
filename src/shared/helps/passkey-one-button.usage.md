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
In this page, you can experience authentication through a dedicated **Sign-in
with a passkey** button. We call it "passkey one button" flow. In addition, you
can try WebAuthn Signal API.

Tap on **Sign in with a passkey** button. If you have a passkey, it displays the
passkey dialog. Otherwise, you will be redirected to a password-based sign-in
form if "immediate mediation" is supported. If "immediate mediation" is not
supported, a QR code dialog is displayed so you can scan it and sign in using a
passkey stored to that device.

If your sign-in attempt is rejected by the server because the public key is not
found on the server, the password manager will delete the passkey to avoid
further confusion. This is done by WebAuthn Signal API.
