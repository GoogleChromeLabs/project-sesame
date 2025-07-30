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

export interface RelyingParty {
  origin: string;
  client_id: Base64URLString;
  name: string;
}

export class RelyingParties {
  static rps = [
    {
      origin: 'https://project-sesame-426206.appspot.com',
      client_id: 'https://project-sesame-426206.appspot.com',
      name: 'Project Sesame',
    } as RelyingParty,
    {
      origin: 'https://project-sesame.local',
      client_id: 'https://project-sesame.local',
      name: 'Project Sesame (Local)',
    } as RelyingParty,
  ];

  static async findByClientID(
    client_id: Base64URLString
  ): Promise<RelyingParty | undefined> {
    const rp = RelyingParties.rps.find(rp => rp.client_id === client_id);
    const clone = structuredClone(rp);
    return Promise.resolve(clone);
  }
}
