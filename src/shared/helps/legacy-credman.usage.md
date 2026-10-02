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

## Legacy Credential Management API

On this page, you can experience sign-in using the legacy Credential Management API (`PasswordCredential` and `FederatedCredential`).

### What is the legacy Credential Management API

Before modern passkeys (WebAuthn) and the Federated Credential Management (FedCM) API, the Credential Management API allowed websites to retrieve stored username/password credentials (`PasswordCredential`) and federated provider tokens (`FederatedCredential`) directly through `navigator.credentials.get()`.

Modern browsers are deprecating and removing `PasswordCredential` and `FederatedCredential` due to privacy and architectural limitations, in favor of [passkey form autofill](/passkey-form-autofill) (WebAuthn Conditional UI) and [FedCM](/fedcm-passive-mode).

### How to test it

- **Check browser support:** If your browser does not support `PasswordCredential` or `FederatedCredential`, an informational notification appears and you are automatically redirected to the passkey autofill demo.
- **Select sign-in:** If supported, click the **Sign-in** button to invoke the legacy credential retrieval prompt.
- **Fallback to form:** Select **Sign in with a form instead** to navigate to the standard password sign-in form.
