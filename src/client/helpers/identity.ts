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

import {$, post} from '~project-sesame/client/helpers/index';
import {saveFederation} from '~project-sesame/client/helpers/federated';

export interface FedCmOptions {
  mode?: 'active' | 'passive';
  loginHint?: string;
  context?: string;
  nonce?: string;
  format?: string;
  fields?: string[];
  mediation?: 'silent' | 'optional' | 'required';
  params?: object;
}

// This is almost identical to the IdentityProvider class at https://sesame-identity-provider.appspot.com/fedcm.js.
// Copied here since some integration needs custom implementation on the RP side.
// ex: unified auth with password, multiple IdPs, etc.
export class SesameIdP {
  urls: string[] = [];
  idps: {
    origin: string;
    configURL: string;
    clientId: string;
  }[] = [];

  constructor(urls: string[] = []) {
    for (const url of urls) {
      this.urls.push(new URL(url).toString());
    }
  }

  async initialize() {
    const options = await post('/federation/options', {
      urls: this.urls,
    });

    for (const option of options.idps) {
      if (!option.configURL || !option.clientId) {
        throw new Error('configURL or client ID is not declared.');
      }
      const url = new URL(option.configURL);
      const idp = {
        origin: url.origin,
        configURL: option.configURL,
        clientId: option.clientId,
      };
      this.idps.push(idp);
    }
    return options.nonce;
  }

  async signIn(
    options: FedCmOptions = {}
    // @ts-ignore
  ): Promise<IdentityCredential | undefined> {
    let {
      mode,
      loginHint,
      context,
      nonce,
      fields,
      mediation,
      params = {},
    } = options;
    if (!nonce) {
      nonce = (<HTMLMetaElement>$('meta[name="nonce"]'))?.content;
    }
    if (!nonce) {
      throw new Error('nonce is not declared.');
    }

    const providers = [];
    for (const idp of this.idps) {
      providers.push({
        configURL: idp.configURL,
        clientId: idp.clientId,
        nonce,
        loginHint,
        fields,
        params,
      });
    }

    try {
      const cred = await navigator.credentials.get({
        // @ts-ignore
        identity: {providers, mode, context},
        mediation,
      });

      /**
       * IdentityCredential {
       *   configURL: string,
       *   id: string,
       *   isAutoSelected: boolean,
       *   token: string,
       *   type: 'identity'
       * }
       */
      return this.verifyIdToken(cred);
    } catch (e: any) {
      console.error(e);
      throw new Error(e.error);
    }
  }

  async delegate(options: FedCmOptions = {}): Promise<string | undefined> {
    let {mode = '', nonce, fields, mediation, params = {}} = options;
    if (!nonce) {
      nonce = (<HTMLMetaElement>$('meta[name="nonce"]'))?.content;
    }
    if (!nonce) {
      throw new Error('nonce is not declared.');
    }

    const providers = [];
    for (let idp of this.idps) {
      providers.push({
        format: 'vc+sd-jwt',
        configURL: idp.configURL,
        clientId: idp.clientId,
        nonce,
        fields,
        params,
      });
    }

    const cred = await navigator.credentials.get({
      // @ts-ignore
      identity: {providers},
      mediation,
    });

    return await this.verifySdJwt(cred);
  }

  // @ts-ignore
  private async verifyIdToken(cred: IdentityCredential): User {
    const idp = this.idps.find(idp => {
      // @ts-ignore
      return idp.configURL === cred?.configURL;
    });

    if (!idp) {
      throw new Error('No verified IdP found.');
    }

    // TODO: Make sure the response is User type
    const user = await post('/federation/verifyIdToken', {
      token: cred.token,
      url: idp.origin,
    });
    await saveFederation(user, idp.configURL);
    return user;
  }

  // @ts-ignore
  private async verifySdJwt(cred: IdentityCredential): User {
    const idp = this.idps.find(idp => {
      // @ts-ignore
      return idp.configURL === cred?.configURL;
    });

    if (!idp) {
      throw new Error('No verified IdP found.');
    }

    // TODO: Create an endpoint that verifies SD JWT
    const user = await post('/federation/verifySdJwt', {
      token: cred.token,
      url: idp.origin,
    });
    return user;
  }
  async signOut() {
    if (navigator.credentials && navigator.credentials.preventSilentAccess) {
      await navigator.credentials.preventSilentAccess();
    }
  }

  // TODO: We must support multiple idp
  // async disconnect(accountId: string) {
  //   try {
  //     // @ts-ignore
  //     return await IdentityCredential.disconnect({
  //       configURL: this.configURL,
  //       clientId: this.clientId,
  //       accountHint: accountId
  //     });
  //   } catch (e) {
  //     throw new Error('Failed disconnecting.');
  //   }
  // }
}
