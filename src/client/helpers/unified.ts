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

import {_fetch} from "~project-sesame/client/helpers/index";
import {IdentityProvider} from "~project-sesame/client/helpers/identity";
import { verifyPassword } from "~project-sesame/client/helpers/password";

// @ts-ignore
export async function authenticate(): Promise<PasswordCredential | string | undefined> {
  try {
    const cred = await navigator.credentials.get({
      // @ts-ignore
      password: true,
      // temporary experiment for unified auth
      federated: {
        providers: [ 'https://fedcm-idp-demo.glitch.me' ],
      },
      mediation: 'required',
    });
    if (cred?.type === 'password') {
      // @ts-ignore
      return verifyPassword(cred as PasswordCredential);
    } else if (cred?.type === 'federated') {
      let idpInfo: any;
      let token;
      try {
        idpInfo = await _fetch('/federation/idp', {
          url: 'https://fedcm-idp-demo.glitch.me',
        });
        const idp = new IdentityProvider({
          configURL: idpInfo.configURL,
          clientId: idpInfo.clientId,
        });
        token = await idp.signIn({
          mode: 'button',
          // loginHint: cred.id,
        });
        await _fetch('/federation/verify', {token, url: idpInfo.origin});
        return true;
      } catch (e) {
        // Silently dismiss the request for now.
        // TODO: What was I supposed to do when FedCM fails other reasons than "not signed in"?
        console.info('The user is not signed in to the IdP.');
        return false;
      }
    } else {
      return false;
    }
  } catch (error: any) {
    console.error(error);
    throw error;
  }
}
