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

On this page, you can try the Federated Credential Management (FedCM) API in
**passive mode**.

### Passive vs. active mode

The FedCM API provides two user experience modes:

- **Passive mode:** The browser shows the identity provider (IdP) sign-in dialog
  as soon as the page loads, without the user clicking anything first. This
  mode suits quick sign-ins for returning users (often called "one-tap"
  sign-in).
- **Active mode:** The sign-in dialog appears only after the user takes an
  action, such as clicking a "Sign in with..." button.

### Prerequisites

- **Chromium-based browser:** Make sure your browser supports FedCM.
- **Signed in to the demo IdP:** The browser only shows the sign-in dialog if
  you're already signed in to the IdP. If you aren't, open the
  [demo identity provider](https://sesame-identity-provider.appspot.com) in
  another tab, sign in to your account, and reload this page.

### How to test it

1. **Observe the sign-in dialog:** As soon as this page loads, the sign-in
   dialog appears in the top-right corner of the browser window.
2. **Confirm to sign in:** Select your account and confirm the dialog to
   complete the federated sign-in.
