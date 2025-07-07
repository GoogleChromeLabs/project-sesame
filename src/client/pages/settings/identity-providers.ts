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

import {html, render} from 'lit';
import '../../layout';
import {$, loading, post} from '../../helpers/index';
import {getAllIdentityProviders} from '~project-sesame/client/helpers/federated';

// TODO: Fetch list of IdPs.
const idps = await post('/federation/idp', {
  urls: [
    'https://sesame-identity-provider.appspot.com',
    'https://accounts.google.com',
  ],
});

// /**
//  * Create a new paskey and register the credential.
//  */
// async function register(): Promise<void> {
//   try {
//     loading.start();
//     await registerCredential();
//     await renderIdentityProviders();
//     loading.stop();
//   } catch (error: any) {
//     // Stop the loading UI
//     loading.stop();
//     // 'InvalidStateError' indicates a passkey already exists on the device.
//     if (error.name === 'InvalidStateError') {
//       toast('A passkey already exists for this device.');
//       // `NotAllowedError` indicates the user canceled the operation.
//     } else if (error.name === 'NotAllowedError') {
//       return;
//       // Show other errors in an toast.
//     } else {
//       toast(error.message);
//       console.error(error);
//     }
//   }
// }

// /**
//  * Rename and update the credential name.
//  */
// async function rename(e: MouseEvent): Promise<void> {
//   if (!(e.target instanceof HTMLButtonElement)) {
//     return;
//   }
//   const {credId, name} = e.target.dataset as {
//     credId: Base64URLString;
//     name: string;
//   };
//   const newName = prompt('Enter a new credential name.', name);
//   if (!newName?.length) return;
//   try {
//     loading.start();
//     await updateCredential(credId, newName);
//     await renderCredentials();
//     loading.stop();
//   } catch (error: any) {
//     loading.stop();
//     console.error(error);
//     toast(error.message);
//   }
// }

// /**
//  * Remove and delete a credential.
//  */
// async function remove(event: {target: HTMLButtonElement}): Promise<void> {
//   if (!confirm('Do you really want to remove this credential?')) return;

//   try {
//     loading.start();
//     await unregisterCredential(<Base64URLString>event.target.dataset.credId);
//     await renderCredentials();
//     loading.stop();
//   } catch (error: any) {
//     loading.stop();
//     console.error(error);
//     toast(error.message);
//   }
// }

/**
 * Render the list of saved credentials.
 */
async function renderIdentityProviders(): Promise<void> {
  const mappings = await getAllIdentityProviders();
  const list = $('#list');
  const result =
    mappings.length > 0
      ? // TODO: Define `cred` type across the server and the client
        html`${mappings.map((map: any, i: number) => {
          const idp = idps.find((idp: any) => {
            return idp.origin === map.iss;
          });
          const idpName = idp?.name || map.iss || 'Unnamed';
          return html`${i > 0 && i < mappings.length
              ? html` <mdui-divider></mdui-divider> `
              : ''}
            <mdui-list-item nonclickable>
              <mdui-icon
                slot="icon"
                src="${idp.iconURL}"
                name="link--outlined"
                title="${idp.name}"
              ></mdui-icon>
              <span>${idpName}</span>
            </mdui-list-item>`;
        })}`
      : html`<mdui-list-item
          >No identity providers are associated yet.</mdui-list-item
        >`;
  render(result, list);
}

loading.start();
// renderDisplayName();
await renderIdentityProviders();
loading.stop();
