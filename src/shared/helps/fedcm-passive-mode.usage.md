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

On this page, you can experience FedCM's **passive mode**.

### Passive vs. active mode

The Federated Credential Management (FedCM) API supports two distinct UX modes:

- **Active Mode**: The FedCM prompt is triggered by a direct user interaction,
  such as clicking a "Sign-in" button.
- **Passive Mode**: The FedCM prompt is initiated automatically when the page
  loads, without requiring any prior user interaction.

### How to test it:

1. **Browser prerequisite:** Ensure you are using a Chromium-based browser that
   supports FedCM.
2. **Observe the prompt**: If your browser supports FedCM, a sign-in dialog
   should appear in the top-right corner as soon as you land on this page. If
   not, create an account and sign in to the demo identity provider at
   [https://sesame-identity-provider.appspot.com](https://sesame-identity-provider.appspot.com)
   , then come back here.
3. **Click the dialog**: Clicking on the one tap dialog allows you to sign in to
   this demo website.
