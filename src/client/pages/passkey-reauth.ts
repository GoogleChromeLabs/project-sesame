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
import {$, loading, redirect, toast} from '~project-sesame/client/helpers/index';
import {capabilities, authenticate} from '~project-sesame/client/helpers/publickey';

// Feature detection: check if WebAuthn and conditional UI are supported.
if (capabilities?.userVerifyingPlatformAuthenticator) {
  $('#passkey-signin').addEventListener(
    'click',
    async (e: {target: HTMLButtonElement}) => {
      try {
        loading.start();
        const user = await authenticate();
        if (user) {
          // If `r` is specified, redirect the user there.
          const url = new URL(location.href);
          const r = url.searchParams.get('r');
          // TODO: This is an open redirect. Prevent it.
          redirect(r || '/home');
        } else {
          throw new Error('User not found.');
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
}
