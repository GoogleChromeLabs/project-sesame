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
  loading,
  redirect,
  postForm,
  toast,
} from '~project-sesame/client/helpers/index';
import {
  capabilities,
  authenticate,
  registerCredential,
} from '~project-sesame/client/helpers/publickey';

postForm()
  .then(async () => {
    // if (capabilities?.conditionalCreate) {
    //   try {
    //     await registerCredential(true);
    //   } catch (error: any) {
    //     if (error.name === 'InvalidStateError') {
    //       console.info('A passkey is already registered for the user.');
    //     } else if (error.name === 'NotAllowedError') {
    //       console.info(
    //         "Passkey was not created because the password didn't match the one in the password manager."
    //       );
    //     } else if (error.name !== 'AbortError') {
    //       console.error(error);
    //     }
    //   }
    // }
    redirect('/home');
  })
  .catch(error => {
    // FIXME: `error.message` is not included.
    toast(error.message);
  });

// Feature detection: check if WebAuthn and conditional UI are supported.
if (capabilities?.conditionalGet) {
  try {
    // If a conditional UI is supported, invoke the conditional `authenticate()` immediately.
    const user = await authenticate('conditional');
    if (user) {
      // When the user is signed in, redirect to the home page.
      $('#username').value = user.username;
      loading.start();
      redirect('/home');
    } else {
      throw new Error('User not found.');
    }
  } catch (error: any) {
    loading.stop();
    console.error(error);
    // `NotAllowedError` indicates a user cancellation.
    // `AbortError` indicates an abort.
    if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
      toast(error.message);
    }
  }
}
