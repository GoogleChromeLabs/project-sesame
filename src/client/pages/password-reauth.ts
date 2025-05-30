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
  setRedirect,
} from '~project-sesame/client/helpers/index';
import {
  capabilities,
  registerCredential,
} from '~project-sesame/client/helpers/publickey';

const r = setRedirect('#passkey-signin');

postForm(
  async () => {
    if (capabilities?.conditionalCreate) {
      try {
        await registerCredential(false, true);
      } catch (error: any) {
        if (error.name === 'InvalidStateError') {
          console.info('A passkey is already registered for the user.');
        } else if (error.name === 'NotAllowedError') {
          console.info(
            "Passkey was not created because the password didn't match the one in the password manager."
          );
        } else if (error.name !== 'AbortError') {
          console.error(error);
        }
      }
    }
    redirect(r || '/home');
  },
  (error: Error) => {
    toast(error.message);
  }
);
