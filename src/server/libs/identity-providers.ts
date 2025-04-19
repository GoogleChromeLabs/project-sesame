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
  origin: string;
  configURL: string;
  clientId: string;
  secret: string;
}

export class IdentityProviders {
  static idps: IdentityProvider[] = [
    {
      origin: 'https://fedcm-idp-demo.glitch.me',
      configURL: 'https://fedcm-idp-demo.glitch.me/fedcm.json',
      clientId: config.origin,
      secret: 'xxxxx',
    },
    {
      origin: 'https://issuer.sgo.to',
      configURL: 'https://issuer.sgo.to/fedcm.json',
      clientId: '1234',
      secret: 'xxxxx',
    },
    {
      origin: 'https://accounts.google.com',
      configURL: 'https://accounts.google.com/gsi/fedcm.json',
      clientId:
        '493201854729-bposa1duevdn4nspp28cmn6anucu60pf.apps.googleusercontent.com',
      secret: '*****',
    },
    {
      origin: 'https://accounts.sandbox.google.com',
      configURL: 'https://accounts.sandbox.google.com/gsi/vc.json',
      clientId: config.origin,
      secret: '*****',
    },
  ];

  static async findByOrigin(
    url: string
  ): Promise<IdentityProvider | undefined> {
    const idp = IdentityProviders.idps.find(idp => {
      return idp.origin === new URL(url).origin;
    });
    return Promise.resolve(structuredClone(idp));
  }
}
