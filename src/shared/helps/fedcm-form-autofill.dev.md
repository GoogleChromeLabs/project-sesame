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

## How to integrate FedCM form autofill

You can enable **FedCM form autofill** by appending `mediation: "conditional"`
to the `navigator.credentials.get()` call to an ordinary FedCM authentication
invocation. Also, the `input` element must contain `webidentity` within its
`autocomplete` attribute.

### Learning resources

- [Implement an identity solution with FedCM on the Relying Party
  side](https://privacysandbox.google.com/cookies/fedcm/implement/relying-party)
