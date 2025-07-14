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
import {$, toast, redirect} from '~project-sesame/client/helpers/index';
import {SesameIdP} from '~project-sesame/client/helpers/identity';

const fedcm = new SesameIdP(['https://sesame-identity-provider.appspot.com']);
await fedcm.initialize();
const google = new SesameIdP(['https://accounts.google.com']);
// `.initialize()` function returns a `nonce`. Since there are multiple
// `.initialize()` functions called in this page, only the last one will be
// recorded in the session. Use the last `nonce` for all `.signIn()` functions.
const nonce = await google.initialize();

const signIn = async (idp: SesameIdP) => {
  try {
    await idp.signIn({mode: 'active', nonce});
    redirect('/home');
  } catch (e: any) {
    console.error(e);
    toast(e.message);
  }
};

if ('IdentityCredential' in window) {
  $('#hidden').classList.remove('hidden');
  $('#unsupported').classList.add('hidden');

  $('#google').addEventListener('click', async (event: MouseEvent) => {
    event.preventDefault();
    await signIn(google);
  });

  $('#fedcm').addEventListener('click', async (event: MouseEvent) => {
    event.preventDefault();
    await signIn(fedcm);
  });
}
