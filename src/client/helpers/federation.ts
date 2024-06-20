/*
 * @license
 * Copyright 2024 Google Inc. All rights reserved.
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

import {_fetch, $} from '~project-sesame/client/helpers/index';
import {User} from '~project-sesame/server/libs/users.ts';

interface FedCmOptions {
  mode?: 'widget' | 'button',
  loginHint?: string,
  context?: string,
  nonce?: string,
  fields?: string[],
  mediation?: 'silent' | 'optional' | 'required',
  params?: object,
}

// This is almost identical to the IdentityProvider class at https://fedcm-idp-demo.glitch.me/fedcm.js.
// Copied here since some integration needs custom implementation on the RP side.
// ex: unified auth with password, multiple IdPs, etc.
export class IdentityProvider {
  origin: string
  configURL: string
  clientId: string

  constructor(
    options: {configURL: string, clientId: string}
  ) {
    if (!options.configURL || !options.clientId) {
      throw new Error('configURL or client ID is not declared.');
    }
    const url = new URL(options.configURL);
    this.origin = url.origin;
    this.configURL = options.configURL;
    this.clientId = options.clientId;
  }

  async signIn(
    options: FedCmOptions = {}
  ): Promise<string | undefined> {
    let { mode = 'widget', loginHint, context, nonce, fields, mediation, params = {} } = options;
    if (!nonce) {
      nonce = (<HTMLMetaElement>$('meta[name="nonce"]'))?.content;
    }
    if (!nonce || !this.clientId) {
      throw new Error('nonce or client_id is not declared.');
    }

    const cred = await navigator.credentials.get({
      // @ts-ignore
      identity: {
        providers: [{
          configURL: this.configURL,
          clientId: this.clientId,
          nonce,
          loginHint,
          fields,
          params,
        }],
        mode,
        context,
      },
      mediation,
    }).catch(e => {
      throw new Error(e.message);
    });
    // @ts-ignore
    return cred?.token;
  }

  async signOut() {
    if (navigator.credentials && navigator.credentials.preventSilentAccess) {
      await navigator.credentials.preventSilentAccess();
    }
  }

  async disconnect(accountId: string) {
    try {
      // @ts-ignore
      return await IdentityCredential.disconnect({
        configURL: this.configURL,
        clientId: this.clientId,
        accountHint: accountId
      });      
    } catch (e) {
      throw new Error('Failed disconnecting.');
    }
  }
}

// let idpInfo: any;
// try {
//   idpInfo = await _fetch('/federation/idp', {
//     url: 'https://fedcm-idp-demo.glitch.me',
//   });
// } catch (error: any) {
//   console.error(error);
//   toast(error.message);
// }

/**
 * Saves a FederatedCredential to the password manager so that the user can
 * easily remember which identity provider is used.
 * @param user 
 * @param configURL 
 * @returns 
 */
export async function saveFederation(user: User, configURL: string): Promise<boolean> {
  try {
    // @ts-ignore
    const cred = new FederatedCredential({
      id: user.username,
      name: user.name,
      provider: configURL,
      iconURL: user.picture,
    });
    await navigator.credentials.store(cred);
    return true;
  } catch (error: any) {
    console.error(error);
    // Return without throwing.
    return false;
  }
}
