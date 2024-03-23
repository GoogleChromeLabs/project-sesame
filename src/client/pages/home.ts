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

import {Base64URLString} from '@simplewebauthn/types';
import {html, render} from 'lit';

import {$, _fetch, loading, toast} from '~project-sesame/client/helpers/index';
import {
  registerCredential,
  unregisterCredential,
  updateCredential,
} from '~project-sesame/client/helpers/passkeys';
import '~project-sesame/client/layout';

const aaguids = await fetch('/aaguids.json');
const icons = await aaguids.json();

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
    await _fetch('/auth/updateDisplayName', {newName});
    loading.stop();
    renderDisplayName();
  }
}

/**
 * Render the user's display name.
 */
async function renderDisplayName(): Promise<void> {
  const res = await _fetch('/auth/userinfo');
  render(
    html`
      <img class="profile-image" src="${res.picture}" width="80" height="80" />
      <h2>Hi, ${res.displayName}</h2>
      <div class="display-name">
        <span>${res.username}</span>
        <md-icon-button
          slot="end"
          data-display-name="${res.displayName || res.username}"
          @click="${changeDisplayName}"
          title="Edit your display name"
        >
          <md-icon>edit</md-icon>
        </md-icon-button>
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

loading.start();
renderDisplayName();
loading.stop();
