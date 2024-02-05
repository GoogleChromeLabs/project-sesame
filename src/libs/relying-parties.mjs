/*
 * @license
 * Copyright 2023 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */

export class RelyingParties {
  static rps = [{
    url: 'https://fedcm-rp-demo.glitch.me',
    client_id: 'fedcm-rp-demo',
    name: 'FedCM RP Demo'
  }]

  static async findByClientID(client_id) {
    const rp = RelyingParties.rps.find(rp => rp.client_id === client_id);
    return Promise.resolve(structuredClone(rp));
  }
};
