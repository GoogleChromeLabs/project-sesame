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
  setRedirect,
} from '~project-sesame/client/helpers/index';

const r = setRedirect('a[href="/signin-form"]');

postForm(
  async () => {
    loading.stop();
    await redirect(r || '/home');
  },
  (error: Error) => {
    loading.stop();
    toast(error.message);
    console.error(error);
  },
  (form: FormData) => {
    const username = (form.get('username') as string) || '';
    const password1 = (form.get('password1') as string) || '';
    const password2 = (form.get('password2') as string) || '';

    // Validate essential inputs before initiating network request
    if (!username.trim()) {
      return 'Please enter a username.';
    }
    if (!password1) {
      return 'Please enter a password.';
    }
    if (password1.length > 128) {
      return 'Password must be 128 characters or fewer.';
    }
    if (password1 !== password2) {
      return 'Passwords do not match.';
    }
    return undefined;
  }
);
