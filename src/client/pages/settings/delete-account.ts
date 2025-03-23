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
import {$, post, loading, redirect, toast} from '~project-sesame/client/helpers/index';

async function deleteAccount(e: MouseEvent): Promise<void> {
  loading.start();
  const confirmation = confirm(
    'Do you really want to detele your account?'
  );
  if (confirmation) {
    try {
      await post('/auth/delete-user');
      // TODO: Signal empty passkey list
      toast('You account has been deleted. Redirecting to the top page.');
      setTimeout(() => {
        // By redirecting to /home, the user should be redirected to the login page.
        redirect('/signout');
      }, 3000);
    } catch (error: any) {
      toast(error.message);
    }
  }
  loading.stop();
}

$('#cancel').addEventListener('click', () => redirect('/home'));
$('#delete-account').addEventListener('click', deleteAccount);
