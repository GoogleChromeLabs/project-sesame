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
import {
  $,
  redirect,
  postForm,
  toast,
} from '~project-sesame/client/helpers/index';
import {SesameIdP} from '~project-sesame/client/helpers/identity';

postForm(
  () => {
    redirect('/home');
  },
  (error: Error) => {
    // FIXME: `error.message` is not included.
    toast(error.message);
  }
);

if ('IdentityCredential' in window) {
  $('#unsupported').classList.add('hidden');
  try {
    const idp = new SesameIdP([
      'https://sesame-identity-provider.appspot.com',
      'https://accounts.google.com',
    ]);
    const nonce = await idp.initialize();
    await idp.signIn({mode: 'passive', mediation: 'required', nonce});
    redirect('/home');
  } catch (e: any) {
    console.error(e);
    toast(e.message);
  }
}
