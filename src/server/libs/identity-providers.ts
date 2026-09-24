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

export interface IdentityProvider {
  name: string;
  iconURL?: string;
  origin: string;
  configURL: string;
  clientId: string;
  secret: string;
}

export class IdentityProviders {
  static idps: IdentityProvider[] = config.supported_idps.map((idp: any) => ({
    ...idp,
    clientId: idp.clientId || config.origin,
  }));

  static async findByOrigin(
    url: string
  ): Promise<IdentityProvider | undefined> {
    const idp = IdentityProviders.idps.find(idp => {
      return idp.origin === new URL(url).origin;
    });
    return Promise.resolve(structuredClone(idp));
  }

  static getPrimaryOrigin(): string | undefined {
    if (config.primary_idp_origin) {
      const primary = this.idps.find(
        idp => idp.origin === config.primary_idp_origin
      );
      if (primary) {
        return primary.origin;
      }
      return config.primary_idp_origin;
    }
    return this.idps[0]?.origin;
  }

  static getOrigins(primaryOnly: boolean = false): string[] {
    if (primaryOnly) {
      const primary = this.getPrimaryOrigin();
      return primary ? [primary] : [];
    }
    return this.idps.map(idp => idp.origin);
  }
}
