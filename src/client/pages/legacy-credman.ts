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
import {legacyAuthenticate} from '../helpers/unified';

//@ts-ignore
if (window.PasswordCredential) {
  $('#signin').addEventListener(
    'click',
    async (e: {target: HTMLButtonElement}) => {
      try {
        loading.start();
        const user = await legacyAuthenticate();
        if (user) {
          redirect('/home');
        } else {
          throw new Error('User is not found.');
        }
      } catch (error: any) {
        loading.stop();
        console.error(error);
        if (error.name !== 'NotAllowedError') {
          toast(error.message);
        }
      }
    }
  );
} else {
  toast("`PasswordCredential` and `FederatedCredential` aren't supported on this browser. Redirecting to a form.");
  setTimeout(() => {
    redirect('/passkey-form-autofill');
  }, 3000);
}
