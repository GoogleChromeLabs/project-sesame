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
  postForm,
  toast,
  post,
} from '~project-sesame/client/helpers/index';
import {
  capabilities,
  authenticate,
} from '~project-sesame/client/helpers/publickey';

post('/auth/userinfo', {})
  .then(user => {
    $('#form').addEventListener('submit', async e => {
      e.preventDefault();
      await postMessage();
    });
  })
  .catch(() => {
    $('#input-fields').classList.remove('hidden');
    postForm(
      async () => {
        await postMessage();
      },
      (error: Error) => {
        toast(error.message);
      }
    );
  });

// Feature detection: check if WebAuthn and conditional UI are supported.
if (capabilities?.conditionalGet) {
  try {
    // If a conditional UI is supported, invoke the conditional `authenticate()` immediately.
    const user = await authenticate({mediation: 'conditional'});
    if (user) {
      $('#username').value = user.username;
      loading.start();
      postMessage();
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

async function postMessage() {
  const urlParams = new URLSearchParams(window.location.search);
  const nonce = urlParams.get('nonce');
  const parent_origin = urlParams.get('origin');
  if (!nonce || !parent_origin) {
    toast('Nonce or parent_origin is missing in the URL');
    return;
  }

  try {
    const response = await post('/fedcm/createToken', {
      nonce,
      rp_origin: parent_origin,
    });
    const token = (response as any).token;
    if (token) {
      window.parent.postMessage({token}, parent_origin);
    } else {
      toast('Failed to generate token');
    }
  } catch (error: any) {
    toast(error.error);
  }
}
