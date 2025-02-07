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

import {Base64URLString} from '@simplewebauthn/server';

/*
  {
    user_id: string
    issuer: string
    subject: string
    name: string
    email: string
    given_name: string
    family_name: string
    picture: string
    issued_at: number
    expires_at: number
  }
*/
export class FederationMappings {
  static async create(
    user_id: Base64URLString,
    options: any = {}
  ): Promise<any> {}

  static async findByIssuer(url: string) {}

  static async findByUserId(user_id: Base64URLString) {}
}
