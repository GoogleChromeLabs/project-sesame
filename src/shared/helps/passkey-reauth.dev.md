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

## Reauthenticate with a passkey

Require reauthentication after a certain duration has passed since the last
user verification.

### Fill in `allowCredentials`

Use [WebAuthn](https://www.w3.org/TR/webauthn/) to build a passkey
reauthentication. It's very similar to [passkey one button](/passkey-one-button)
experience, except that it limits the passkey the user can use, to prevent
signing in as a different user.

To do so, pass the list of credential IDs saved to the user account in
`allowCredentials`.

### Verify the passkey owner matches the signed-in user

Also, don't forget to verify that the owner of the passkey matches the signed-in
user on the server side. If an attacker can inject an assertion for another
user, they may be able to do nasty things.
