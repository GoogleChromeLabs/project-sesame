/*
 * @license
 * Copyright 2023 Google Inc. All rights reserved.
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

import crypto from 'crypto';
import {isoBase64URL} from '@simplewebauthn/server/helpers';

export function generateRandomString(num_of_bytes: number = 32): string {
  return isoBase64URL.fromBuffer(crypto.randomBytes(num_of_bytes));
}

export function getGravatarUrl(username: string): string {
  const pictureURL = new URL('https://www.gravatar.com/');
  pictureURL.pathname = `/avatar/${crypto
    .createHash('md5')
    .update(username)
    .digest('hex')}`;
  pictureURL.searchParams.append('s', '200');
  return pictureURL.toString();
}

export function compareUrls(url1?: string, url2?: string): boolean {
  if (!url1 || !url2) return false;
  const origin1 = new URL(url1).origin;
  const origin2 = new URL(url2).origin;
  return origin1 === origin2;
}
