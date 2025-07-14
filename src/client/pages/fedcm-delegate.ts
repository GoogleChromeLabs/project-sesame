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
  loading,
  redirect,
  postForm,
  toast,
} from '~project-sesame/client/helpers/index';
import {SesameIdP} from '~project-sesame/client/helpers/identity';

postForm(
  () => {
    loading.stop();
    redirect('/new-password');
  },
  (error: Error) => {
    loading.stop();
    toast(error.message);
    console.error(error);
  }
);

// Feature detection: check if WebAuthn and conditional UI are supported.
// @ts-ignore
if (window.IdentityCredential) {
  try {
    const idp = new SesameIdP([
      'https://accounts.sandbox.google.com',
      'https://issuer.sgo.to',
    ]);
    const nonce = await idp.initialize();
    await idp.delegate({
      fields: ['name', 'email', 'picture'],
      // @ts-ignore
      mediation: 'conditional',
      nonce,
    });
    redirect('/home');
  } catch (error: any) {
    loading.stop();
    console.error(error);
    // `NotAllowedError` indicates a user cancellation.
    if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
      toast(error.message);
    }
  }
}
