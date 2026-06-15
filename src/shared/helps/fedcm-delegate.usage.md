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

In this page, you can experience and learn FedCM and its "delegation flow". With
FedCM delegation flow, you can sign up to the website with a verified email
address.

_The SD JWT is not verified at the moment. The resulting account is static to be
`me@sgo.to` with name 'Sam Goto'._

## Prerequisites

- Chrome desktop 137 or later with the following flags:
  - "FedCM with delegation support" flag: `chrome://flags/#fedcm-delegation`
  - "FedCmWithoutWellKnownEnforcement" flag: `chrome://flags/#fedcm-without-well-known-enforcement`
  - "FedCmMultiIdP" flag: `chrome://flags/#fedcm-multi-idp`
  - "FedCM with IdP Registration support" flag: `chrome://flags/#fedcm-idp-registration`
  - "FedCMAutofill" flag: `chrome://flags/#fedcm-autofill`

Last updated: 2025/05/18

Just put your cursor on the input field. You should see `me@sgo.to` acount in
the autofill suggestion. It may take a few seconds for the account to show up.

By clicking on it, you can sign up to the website using SD JWT that contains a
verified email address. This means the website doesn't have to send an email to
the registered email address, the user doesn't have to open it and click a link
in the email, to verify the email address.
