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
import {$, post, loading, toast} from '~project-sesame/client/helpers/index';
import {Base64URLString} from '@simplewebauthn/server';
import {
  capabilities,
  getAllCredentials,
  registerCredential,
  unregisterCredential,
  updateCredential,
} from '~project-sesame/client/helpers/publickey';
import '~project-sesame/client/layout';

/**
 * Change and update the user's display name.
 */
async function changeDisplayName(e: {
  target: HTMLButtonElement;
}): Promise<void> {
  const newName = prompt(
    'Enter a new display name',
    e.target.dataset.displayName
  );
  if (!newName?.length) {
    loading.start();
    await post('/auth/updateDisplayName', {newName});
    loading.stop();
    renderDisplayName();
  }
}

/**
 * Render the user's display name.
 */
async function renderDisplayName(): Promise<void> {
  const res = await post('/auth/userinfo');
  render(
    html`
      <img class="profile-image" src="${res.picture}" width="80" height="80" />
      <h2>Hi, ${res.displayName}</h2>
      <div class="display-name">
        <span>${res.username}</span>
        <mdui-button-icon
          data-display-name="${res.displayName || res.username}"
          @click="${changeDisplayName}"
          icon="edit"
          title="Edit your display name"
        ></mdui-button-icon>
      </div>
    `,
    $('#userinfo')
  );
}

/**
 * Rename and update the credential name.
 */
async function rename(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  }
  const {credId, name} = e.target.dataset as {
    credId: Base64URLString;
    name: string;
  };
  const newName = prompt('Enter a new credential name.', name);
  if (!newName?.length) return;
  try {
    loading.start();
    await updateCredential(credId, newName);
    await renderCredentials();
    loading.stop();
  } catch (error: any) {
    loading.stop();
    console.error(error);
    toast(error.message);
  }
}

/**
 * Remove and delete a credential.
 */
async function remove(event: {target: HTMLButtonElement}): Promise<void> {
  if (!confirm('Do you really want to remove this credential?')) return;

  try {
    loading.start();
    await unregisterCredential(<Base64URLString>event.target.dataset.credId);
    await renderCredentials();
    loading.stop();
  } catch (error: any) {
    loading.stop();
    console.error(error);
    toast(error.message);
  }
}

const createPasskey = $('#create-passkey');

// Is WebAuthn available on this browser?
if (
  capabilities?.userVerifyingPlatformAuthenticator &&
  capabilities?.conditionalGet
) {
  // If both are available, reveal the "Create a passkey" button.
  createPasskey.classList.remove('hidden');
} else {
  // If the condition does not match, show a message.
  $('#message').innerText = 'This device does not support passkeys.';
}

/**
 * Render the list of saved credentials.
 */
async function renderCredentials(): Promise<void> {
  const res = await getAllCredentials();
  const list = $('#list');
  const creds =
    res.length > 0
      ? // TODO: Define `cred` type across the server and the client
        html`${res.map((cred, i: number) => {
          let timestampStr = '';
          if (cred.lastUsedAt) {
            const lastUsed = new Date(cred.lastUsedAt);
            const lastUsedDate = lastUsed.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            timestampStr = `Last used ${lastUsedDate}`;
          } else {
            const created = new Date(cred.registeredAt);
            const createdDate = created.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            timestampStr = `Created ${createdDate}`;
          }
          return html`${i > 0 && i < res.length
              ? html` <mdui-divider></mdui-divider> `
              : ''}
            <mdui-list-item nonclickable>
              <mdui-icon
                slot="icon"
                src="${cred.providerIcon}"
                title="${cred.name}"
              ></mdui-icon>
              <span>${cred.name || 'Unnamed'}</span>
              <span slot="description">
                ${timestampStr}
                ${!cred.credentialBackedUp ? html`・Device only` : ''}
              </span>
              <mdui-button-icon
                slot="end-icon"
                data-cred-id="${cred.id}"
                data-name="${cred.name || 'Unnamed'}"
                icon="edit--outlined"
                @click="${rename}"
              ></mdui-button-icon>
              <mdui-button-icon
                slot="end-icon"
                data-cred-id="${cred.id}"
                icon="delete--outlined"
                @click="${remove}"
              ></mdui-button-icon>
            </mdui-list-item>`;
        })}`
      : html`<mdui-list-item>No credentials found.</mdui-list-item>`;
  render(creds, list);
}

/**
 * Create a new paskey and register the credential.
 */
async function register(): Promise<void> {
  try {
    loading.start();
    await registerCredential(true);
    await renderCredentials();
    loading.stop();
  } catch (error: any) {
    // Stop the loading UI
    loading.stop();
    // 'InvalidStateError' indicates a passkey already exists on the device.
    if (error.name === 'InvalidStateError') {
      toast('A passkey already exists for this device.');
      // `NotAllowedError` indicates the user canceled the operation.
    } else if (error.name === 'NotAllowedError') {
      return;
      // Show other errors in an toast.
    } else {
      toast(error.message);
      console.error(error);
    }
  }
}

loading.start();
// renderDisplayName();
await renderCredentials();
loading.stop();

createPasskey.addEventListener('click', register);
