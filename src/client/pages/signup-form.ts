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
import {loading, redirect, postForm, toast} from '~project-sesame/client/helpers';
import {registerCredential} from '~project-sesame/client/helpers/passkeys';

postForm().then(async () => {
  // WebAuthn and conditional UI are supported.
  if (
    window.PublicKeyCredential &&
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
    PublicKeyCredential.isConditionalMediationAvailable
  ) {
    // Are UVPAA and conditional UI available on this browser?
    const available = await Promise.all([
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
      PublicKeyCredential.isConditionalMediationAvailable(),
    ]);
    if (available.every(r => r === true)) {
      return registerCredential().then(() => {
        redirect('/home');
      }).catch(error => {
        // 'InvalidStateError' indicates a passkey already exists on the device.
        if (error.name === 'InvalidStateError') {
          toast('A passkey already exists for this device.');
          // `NotAllowedError` indicates the user canceled the operation.
        } else if (error.name === 'NotAllowedError') {
          return;
          // Show other errors in an alert.
        } else {
          loading.stop();
          toast(error.message);
          console.error(error);
        }
      });
    } else {
      loading.stop();
      redirect('/new-password');
    }
  }
}).catch(error => {
  loading.stop();
  toast(error.message);
  console.error(error);
});
