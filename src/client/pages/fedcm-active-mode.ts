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
// @ts-ignore
import {IdentityProvider} from '~project-sesame/client/helpers/identity';

const fedcm = new IdentityProvider(['https://fedcm-idp-demo.glitch.me']);
fedcm.initialize();
const google = new IdentityProvider(['https://accounts.google.com']);
google.initialize();
const sgo = new IdentityProvider(['https://issuer.sgo.to']);
sgo.initialize();

const signIn = async (idp: IdentityProvider) => {
  try {
    await idp.signIn({mode: 'active'});
    redirect('/home');
  } catch (e: any) {
    console.error(e);
    toast(e.message);
  }
};

if ('IdentityCredential' in window) {
  $('#hidden').classList.remove('hidden');
  $('#unsupported').classList.add('hidden');

  $('#google').addEventListener('click', (event: any) => {
    event.preventDefault();
    signIn(google);
  });

  $('#fedcm').addEventListener('click', (event: any) => {
    event.preventDefault();
    signIn(fedcm);
  });

  $('#sgo').addEventListener('click', (event: any) => {
    event.preventDefault();
    signIn(sgo);
  });
}
