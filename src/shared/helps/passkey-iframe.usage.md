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

## Passkeys in an iframe

On this page, you can see how a website can embed an identity provider (IdP) in
an `<iframe>` so users can sign in with a passkey inside it. The website makes
this possible by giving the iframe permission to use passkeys.

### Prerequisites

- **Passkey on the demo IdP:** Register an account on the
  [demo IdP](https://sesame-identity-provider.appspot.com) and add a passkey, if
  you haven't already.

### How to test it

1. **Observe the embedded IdP:** The sign-in form on this page is an `<iframe>`
   hosted on the IdP domain (`https://sesame-identity-provider.appspot.com`).
2. **Autofill or sign in within the iframe:** If your browser supports passkey
   autofill (conditional UI), select the username field in the iframe and
   choose your saved IdP passkey from the autofill suggestions.
3. **Cross-origin token exchange:** After you verify with your passkey in the
   iframe, the IdP creates an authentication token and securely sends it to the
   parent window with `postMessage()`.
4. **Automatic sign-in:** The parent site receives and verifies the token, then
   signs you in and redirects you to the home page.
