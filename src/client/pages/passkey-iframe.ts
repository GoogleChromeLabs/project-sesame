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
  redirect,
  toast,
} from '~project-sesame/client/helpers/index';
import {SesameIdP} from '~project-sesame/client/helpers/identity';

try {
  const origin = 'https://idp.localhost';
  const idp = new SesameIdP([origin]);
  await idp.initialize();
  const nonce = (<HTMLMetaElement>$('meta[name="nonce"]'))?.content;
  if (!nonce) throw new Error('nonce is not defined');

  const iframeElem = document.createElement('iframe');
  const url = new URL('/iframe-federation', origin);
  url.searchParams.append('nonce', nonce);
  url.searchParams.append('origin', location.origin);
  iframeElem.src = url.toString();
  iframeElem.allow = 'publickey-credentials-get';
  $('#iframe').appendChild(iframeElem);

  await idp.iframe({nonce});
  await redirect('/home');
} catch (exception: any) {
  loading.stop();
  console.error(exception.error);
  toast(exception.message);
}
