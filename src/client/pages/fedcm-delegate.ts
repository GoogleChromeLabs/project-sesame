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
import {loading, redirect, postForm, toast, post} from '~project-sesame/client/helpers/index';
import {IdentityProvider} from '~project-sesame/client/helpers/identity';

postForm().then(() => {
  loading.stop();
  redirect('/home');
}).catch(error => {
  loading.stop();
  toast(error.message);
  console.error(error);
});

// Feature detection: check if WebAuthn and conditional UI are supported.
// @ts-ignore
if (window.IdentityCredential) {
  let idp;
  let idpInfo: any;
  try {
    idpInfo = await post('/federation/idp', {
      url: 'https://accounts.sandbox.google.com',
    });
    idp = new IdentityProvider({
      configURL: idpInfo.configURL,
      clientId: idpInfo.clientId,
    });
  } catch (e) {
    // Silently dismiss the request for now.
    // TODO: What was I supposed to do when FedCM fails other reasons than "not signed in"?
    console.info('The user is not signed in to the IdP.');
  }

  try {
    // If a conditional UI is supported, invoke the conditional `authenticate()` immediately.
    const token = await idp.delegate({
      fields: ['name', 'email', 'picture'],
      mediation: 'conditional'
    });
    if (token) {
      // When the user is signed in, redirect to the home page.
      console.log(token);
      // $('#username').value = user.username;
      loading.start();
      redirect('/home');
    } else {
      throw new Error('User not found.');
    }
  } catch (error: any) {
    loading.stop();
    console.error(error);
    // `NotAllowedError` indicates a user cancellation.
    if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
      toast(error.message);
    }
  }
}
