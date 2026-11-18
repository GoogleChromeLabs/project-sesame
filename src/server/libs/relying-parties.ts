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

import {config} from '../config.ts';
import {compareUrls} from './helpers.ts';

export interface RelyingParty {
  origin: string;
  client_id: string;
  name: string;
  secret: string;
}

export class RelyingParties {
  static rps: RelyingParty[] = config.supported_rps;

  /**
   * Finds a registered Relying Party by its `client_id`.
   *
   * @param client_id - The Relying Party client ID to look up.
   * @returns A cloned `RelyingParty` record if registered, or `undefined`.
   */
  static async findByClientID(
    client_id: unknown
  ): Promise<RelyingParty | undefined> {
    if (typeof client_id !== 'string' || !client_id.trim()) {
      return undefined;
    }
    const rp = RelyingParties.rps.find(rp => rp.client_id === client_id);
    return structuredClone(rp);
  }

  /**
   * Finds a registered Relying Party by comparing full URL origins.
   *
   * @param origin - The Relying Party origin URL to look up.
   * @returns A cloned `RelyingParty` record if registered, or `undefined`.
   */
  static async findByOrigin(
    origin: unknown
  ): Promise<RelyingParty | undefined> {
    if (typeof origin !== 'string' || !origin.trim()) {
      return undefined;
    }
    const rp = RelyingParties.rps.find(rp => compareUrls(rp.origin, origin));
    return structuredClone(rp);
  }
}
