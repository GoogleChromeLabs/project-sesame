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

On this page, you can experience how a website can embed an identity provider (IdP) within an `<iframe>` to allow seamless passkey authentication using browser permission delegation.

### Why iframes need explicit permission for WebAuthn

By default, modern web browsers block the WebAuthn API inside cross-origin `<iframe>` elements to prevent clickjacking and credential phishing attacks.

However, many identity federation architectures require embedding a trusted IdP sign-in widget directly inside a relying party (RP) webpage. To support this securely, the browser allows the top-level site to explicitly delegate passkey retrieval rights to a trusted iframe origin using the Permissions Policy feature `publickey-credentials-get`.

### How to test it

- **Prerequisites:** You need an account registered on the demo IdP with a saved passkey. If you haven't created one yet, visit the [demo IdP](https://sesame-identity-provider.appspot.com) to register an account and add a passkey.
- **Observe the embedded IdP:** The page embeds an `<iframe>` hosted on the IdP domain (`https://sesame-identity-provider.appspot.com`).
- **Autofill or sign in within the iframe:** If conditional UI is supported, passkey autofill is initiated directly within the iframe. Select your saved IdP passkey from the autofill prompt.
- **Cross-origin token exchange:** Once you verify with your passkey inside the iframe, the IdP generates an authentication token and securely transmits it to the parent window via `postMessage()`.
- **Automatic sign-in:** The parent site receives and verifies the token, signing you in and redirecting to the home page.
