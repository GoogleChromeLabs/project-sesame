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

import {$, _fetch, loading} from '~project-sesame/client/helpers/index';
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

loading.start();
renderDisplayName();
loading.stop();
