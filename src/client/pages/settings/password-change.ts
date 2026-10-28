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
} from '~project-sesame/client/helpers/index';

postForm(
  async () => {
    $('#form').style = 'display:none';
    toast('Your password has been changed. Redirecting to the home page.');
    await redirect('/home', 3000);
  },
  (error: Error) => {
    toast(error.message);
  },
  (form: FormData) => {
    const p1 = (form.get('new-password1') as string) || '';
    const p2 = (form.get('new-password2') as string) || '';

    // Validate inputs locally before submitting
    if (!p1) {
      return 'Please enter a new password.';
    }
    if (p1.length > 128) {
      return 'Password must be 128 characters or fewer.';
    }
    if (p1 !== p2) {
      return 'New passwords do not match.';
    }
    return undefined;
  }
);
