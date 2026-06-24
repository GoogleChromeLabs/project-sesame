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

On this page, you can experience FedCM's **active mode**.

### Active vs. passive Mode

The Federated Credential Management (FedCM) API supports two distinct UX modes:

- **Active Mode**: The FedCM prompt is triggered by a direct user interaction,
  such as clicking a "Sign-in" button.
- **Passive Mode**: The FedCM prompt is initiated automatically when the page
  loads, without requiring any prior user interaction.

### How to test it:

1. **Browser Prerequisite:** Ensure you are using a Chromium-based browser that
   supports FedCM.
2. **Trigger the flow:** Click the **Sign-in with FedCM Demo IdP** button.
3. **Complete the sign-in:** A browser-native FedCM dialog will appear. Follow
   the prompts to select your account and complete the sign-in flow.
4. **Sign in to the IdP:** If you are not signed in to the IdP yet, a popup
   window will appear so you can sign in to [the
   IdP](https://sesame-identity-provider.appspot.com). As soon as you are signed
   in, you'll be able to sign in to the RP.
