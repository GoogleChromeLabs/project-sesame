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
Use [WebAuthn](https://www.w3.org/TR/webauthn/) to build a passkey experience.

You can create a passkey by invoking `navigator.credentials.create()` call. Make
sure that the new passkey is associated with the new username the user has just
entered.

There are a lot of tricks you can perform to make the future passkey experience
better. Here's a checklist:

* Specify `"platform"` as the authenticator attachment value to pass to
`navigator.credentials.create()` for a promoted passkey creation.  
* Verify the user with the strongest authentication method available for the
user before allowing them to create a passkey.  
* Prevent creating duplicate passkeys for the same passkey provider using
[`excludeCredentials`](https://web.dev/articles/webauthn-exclude-credentials).  
* [Use the AAGUID to identify the passkey
provider](https://web.dev/articles/webauthn-aaguid) and to name the credential
for the user.  
* Signal if an attempt to register a passkey fails with
[`PublicKeyCredential.signalUnknownCredential()`](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-that-a-credential-does-not-exist).  
* [Send a notification to the
user](https://web.dev/articles/passkey-registration#send_a_notification_to_the_user)
after creating and registering a passkey for their account.  

### Learning resources

* [Create a passkey for passwordless
logins](https://web.dev/articles/passkey-registration)
* [Server-side passkey
registration](https://developers.google.com/identity/passkeys/developer-guides/server-registration)
* [Implement passkeys with form autofill in a web
app](https://goo.gle/passkeys-codelab)
