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

## FedCM active mode

On this page, you can try the Federated Credential Management (FedCM) API in
**active mode**.

### Active vs. passive mode

The FedCM API provides two distinct user experience modes:

- **Active mode:** The authentication request is triggered by an explicit user
  gesture, such as clicking a dedicated "Sign in with..." button. This mode
  provides a prominent modal sign-in dialog and allows users who are currently
  signed out of the identity provider (IdP) to sign in to the IdP directly via a
  browser popup.
- **Passive mode:** The sign-in dialog appears automatically when the page
  loads, without requiring user interaction.

### Prerequisites

- **Chromium-based browser:** Make sure your browser supports FedCM.

### How to test it

1. **Trigger the sign-in flow:** Click the **Sign-in with FedCM Demo IdP**
   button.
2. **Authenticate with the IdP (if signed out):** If you aren't currently signed
   in to the IdP, the browser automatically opens an IdP sign-in popup window
   pointing to [the demo IdP](https://sesame-identity-provider.appspot.com).
   Sign in to the IdP within that window. Once you're signed in, the popup
   closes and the FedCM flow resumes.
3. **Select an account:** The sign-in dialog appears and shows your IdP
   account. Select your account to sign in to this demo application.
