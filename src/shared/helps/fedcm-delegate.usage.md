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

## Account creation with FedCM delegation

On this page, you can experience account registration using FedCM delegation with Verifiable Credentials.

### What is FedCM delegation

Traditional sign-up forms require users to manually type their name, email address, and profile details. With **FedCM delegation**, the relying party requests verified identity attributes directly from an identity provider (IdP) using Verifiable Credentials (such as SD-JWT format).

When combined with form autofill (`autocomplete="email webidentity"`), users can select their federated identity directly from the browser's autofill dropdown to instantly populate their registration information.

### How to test it

- **Check browser support:** Ensure you are using a Chromium-based browser with FedCM enabled.
- **Focus the username field:** Click or tap the username input to trigger browser autofill suggestions showing available identity provider credentials.
- **Select an identity:** Choose a federated identity from the dropdown to automatically retrieve your verified credentials (such as name, email, and picture).
- **Manual sign-up:** Alternatively, enter a username and click **Create your account** to proceed through the standard demo registration flow.
