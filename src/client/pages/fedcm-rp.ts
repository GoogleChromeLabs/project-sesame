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
import {$, _fetch, redirect, postForm, toast} from '~project-sesame/client/helpers/index';
import '@material/web/textfield/outlined-text-field';
// @ts-ignore
const {IdentityProvider} = await import(
  /* webpackIgnore: true */ 'https://fedcm-idp-demo.glitch.me/fedcm.js'
);

let idpInfo: any;
try {
  idpInfo = await _fetch('/federation/idp', {
    url: 'https://fedcm-idp-demo.glitch.me',
  });
} catch (error: any) {
  console.error(error);
  toast(error.message);
}

const idp = new IdentityProvider({
  configURL: idpInfo.configURL,
  clientId: idpInfo.clientId,
});

postForm().then(() => {
  redirect('/password');
}).catch(error => {
  toast(error.message);
});

const signIn = async () => {
  let token;
  try {
    token = await idp.signIn();
  } catch (e) {
    // Silently dismiss the request for now.
    // TODO: What was I supposed to do when FedCM fails other reasons than "not signed in"?
    console.info('The user is not signed in to the IdP.');
    return;
  }

  try {
    await _fetch('/federation/verify', {token, url: idpInfo.origin});
    location.href = '/home';
  } catch (error: any) {
    console.info(error);
    toast(error.message);
  }
};

if ('IdentityCredential' in window) {
  await signIn();
} else {
  $('#unsupported').classList.remove('hidden');
}
