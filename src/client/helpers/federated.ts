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

import '~project-sesame/client/layout';
import {html, render} from 'lit';
import {toast, get} from '~project-sesame/client/helpers/index';
import {IdentityProvider} from '~project-sesame/client/helpers/identity';
import {User} from '~project-sesame/server/libs/users';

export async function authenticate(): Promise<
  // @ts-ignore
  PasswordCredential | string | undefined
> {
  try {
    const idp = new IdentityProvider(['https://fedcm-idp-demo.glitch.me']);
    await idp.initialize();
    const cred = await navigator.credentials.get({
      // temporary experiment for unified auth
      // @ts-ignore
      federated: {
        providers: idp.urls,
      },
      mediation: 'required',
    });
    if (cred) {
      try {
        await idp.signIn({
          mode: 'active',
          // loginHint: cred.id,
        });
        return true;
      } catch (e: any) {
        console.error(e);
        toast(e.message);
      }
    } else {
      return false;
    }
  } catch (error: any) {
    console.error(error);
    throw error;
  }
}

/**
 * Saves a FederatedCredential to the password manager so that the user can
 * easily remember which identity provider is used.
 * @param user
 * @param configURL
 * @returns
 */
export async function saveFederation(
  user: User,
  configURL: string
): Promise<boolean> {
  try {
    // @ts-ignore
    const cred = new FederatedCredential({
      id: user.username,
      name: user.displayName,
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

export async function getAllIdentityProviders(): Promise<any> {
  return get('/federation/mappings');
}
