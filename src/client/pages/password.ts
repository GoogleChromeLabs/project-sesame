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

import '@material/web/textfield/outlined-text-field';

import '~project-sesame/client/layout';
import {redirect, toast, $, loading, _fetch} from '~project-sesame/client/helpers';

const form = $('#form');
// When the form is submitted, proceed to the password form.
form.addEventListener('submit', async (s: any) => {
  s.preventDefault();
  const form = new FormData(s.target);

  // If `PasswordCredential` is supported, store it to the password manager.
  // @ts-ignore
  if (window.PasswordCredential) {
    // @ts-ignore
    const password = new PasswordCredential(form);
    await navigator.credentials.create(password);
  }
  const cred = {} as any;
  form.forEach((v, k) => (cred[k] = v));
  loading.start();
  _fetch(s.target.action, cred)
  .then(results => {
    redirect('/home');
  })
  .catch(error => {
    loading.stop();
    console.error(error.message);
    toast(error.message);
  });
});
