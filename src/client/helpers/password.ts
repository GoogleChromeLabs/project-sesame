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

import {post} from '~project-sesame/client/helpers/index';

export async function verifyPassword(
  // @ts-ignore
  cred: PasswordCredential
): Promise<boolean> {
  await post('/auth/username-password', {
    username: cred.id,
    // @ts-ignore
    password: cred.password,
  });
  return true;
}

export async function authenticate(): Promise<
  // @ts-ignore
  PasswordCredential | string | undefined
> {
  try {
    const cred = await navigator.credentials.get({
      // @ts-ignore
      password: true,
      mediation: 'required',
    });
    if (cred) {
      // @ts-ignore
      return verifyPassword(cred as PasswordCredential);
    } else {
      return false;
    }
  } catch (error: any) {
    console.error(error);
    throw error;
  }
}
