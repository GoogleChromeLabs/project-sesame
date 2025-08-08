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

import '../layout';
import {$, loading, redirect, toast} from '../helpers/index';
import {capabilities, authenticate} from '../helpers/unified';

if (
  //@ts-ignore
  window.PasswordCredential &&
  window.PublicKeyCredential &&
  // @ts-ignore
  // window.IdentityCredential &&
  capabilities.immediateGet
) {
  $('#signin').addEventListener(
    'click',
    async (e: {target: HTMLButtonElement}) => {
      try {
        loading.start();
        const user = await authenticate('immediate');
        if (user) {
          await redirect('/home');
        } else {
          throw new Error('User is not found.');
        }
      } catch (error: any) {
        loading.stop();
        console.error(error);
        if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
          toast(error.message);
        }
      }
    }
  );
} else {
  toast(
    "WebAuthn isn't supported on this browser. Redirecting to a passkey autofill form."
  );
  await redirect('/passkey-form-autofill', 3000);
}

// // Feature detection: check if WebAuthn and conditional UI are supported.
// if (capabilities?.conditionalGet) {
//   try {
//     // If a conditional UI is supported, invoke the conditional `authenticate()` immediately.
//     const user = await authenticate('conditional');
//     if (user) {
//       // When the user is signed in, redirect to the home page.
//       $('#username').value = user.username;
//       loading.start();
//       await redirect('/home');
//     } else {
//       throw new Error('User not found.');
//     }
//   } catch (error: any) {
//     loading.stop();
//     console.error(error);
//     // `NotAllowedError` indicates a user cancellation.
//     if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
//       toast(error.message);
//     }
//   }
// }
