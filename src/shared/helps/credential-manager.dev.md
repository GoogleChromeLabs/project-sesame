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

## How to integrate immediate UI mode

Immediate UI mode is suitable for sign-ins without a page transition. There are
a few benefits to use this API:

- Simplify the sign-in page: instead of displaying a sign-in form and a bunch of social logins,

### Feature detection

Support for immediate UI mode is still limited.

### Append `uiMode: 'immediate'`

Immediate UI mode can be implemented using `navigator.credentials.get()` with
`uiMode: "immediate"` and a different credential types. It can accept
`PublicKeyCredential` (passkeys) and `PasswordCredential` (passwords) at the
moment. In the future, `IdentityCredential` (FedCM) will be accepted as well.

### Learning resources

- [Simpler WebAuthn feature detection](https://web.dev/articles/webauthn-client-capabilities)
- [Immediate UI mode for logins](https://developer.chrome.com/docs/identity/immediate-ui-mode)
