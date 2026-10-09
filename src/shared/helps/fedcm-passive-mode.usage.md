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

## FedCM passive mode

On this page, you can experience the Federated Credential Management (FedCM) API running in **passive mode**.

### Passive vs. active mode

The FedCM API provides two distinct user experience modes:

- **Passive mode:** The browser automatically triggers the identity provider (IdP) prompt when the page loads, without requiring any prior user gesture. This mode is ideal for low-friction, returning-user sign-ins (often called "one-tap" sign-in).
- **Active mode:** The sign-in prompt is initiated explicitly by a direct user action, such as clicking a "Sign in with..." button.

### How to test it

- **Check browser support:** Ensure you are using a Chromium-based browser that supports FedCM.
- **Sign in to the IdP first:** In passive mode, the browser only displays the prompt if you are already signed in to a supported IdP. If you haven't signed in yet, open <a href="https://sesame-identity-provider.appspot.com/signup-form" target="_blank">the demo identity provider</a>, create an account, close the tab and reload this page.
- **Observe the browser prompt:** As soon as this page loads, a native sign-in dialog appears in the top-right corner of the browser window.
- **Confirm to sign in:** Select your account and confirm the prompt to complete the federated sign-in immediately.
