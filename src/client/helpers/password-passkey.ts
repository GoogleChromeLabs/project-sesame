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

import {_fetch} from "~project-sesame/client/helpers/index";
import { preparePublicKeyRequestOptions, verifyPublicKeyRequestResult } from "~project-sesame/client/helpers/publickey";
import { verifyPassword } from "~project-sesame/client/helpers/password";

// @ts-ignore
export async function authenticate(): Promise<PasswordCredential | string | undefined> {
  const options = await preparePublicKeyRequestOptions(false);

  const cred = await navigator.credentials.get({
    // @ts-ignore
    password: true,
    // temporary experiment for unified auth
    publickey: options,
  });

  if (cred?.type === 'password') {
    // @ts-ignore
    return verifyPassword(cred as PasswordCredential);
  } else if (cred?.type === 'publickey') {
    return verifyPublicKeyRequestResult(cred as PublicKeyCredential);
  } else {
    throw new Error("Failed to get a credential");
  }
}
