/*
 * @license
 * Copyright 2026 Google Inc. All rights reserved.
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
import {ButtonIcon} from 'mdui/components/button-icon';
import {
  $,
  loading,
  redirect,
  toast,
} from '~project-sesame/client/helpers/index';
import {
  capabilities,
  authenticate,
} from '~project-sesame/client/helpers/unified';

const shop = $('#shop') as HTMLElement;
let isSignedIn = shop.dataset.signedIn === 'true';
let isAuthenticating = false;

const isPassiveSupported = Boolean(
  'PasswordCredential' in window &&
  window.PublicKeyCredential &&
  (capabilities?.conditionalPassive || capabilities?.ambientGet)
);

const isImmediateSupported = Boolean(
  'PasswordCredential' in window &&
  window.PublicKeyCredential &&
  capabilities?.immediateGet
);

/**
 * Updates the page UI in place when the user signs in.
 * @param {Record<string, any>} user - The authenticated user object.
 */
function setSignedInState(user: Record<string, any>): void {
  isSignedIn = true;
  shop.dataset.signedIn = 'true';
  $('#signin').hidden = true;
  $('#signup').hidden = true;
  $('#signout').hidden = false;
  if ('picture' in user && user.picture) {
    $('#account-avatar').src = user.picture;
  }
}

/**
 * Initiates a passive Conditional UI credential request on page load when the
 * user is signed out and the browser supports the `conditionalPassive` (or
 * `ambientGet`) capability.
 */
async function initPassiveSignIn(): Promise<void> {
  if (isSignedIn || !isPassiveSupported) return;

  try {
    const user = await authenticate({
      mediation: 'conditional',
      // @ts-ignore
      ui_mode: 'passive',
    });
    if (user && typeof user === 'object') {
      setSignedInState(user);
      toast('Signed in with Passive UI mode');
    } else {
      throw new Error('User is not found.');
    }
  } catch (error: any) {
    if (error.name === 'AbortError') return;
    console.error(error);
    if (error.name !== 'NotAllowedError') {
      toast(error.message);
    }
  }
}

$('#product-grid').addEventListener('click', async (e: MouseEvent) => {
  if (!(e.target instanceof Element)) return;
  const button = e.target.closest<ButtonIcon>('.favorite-button');
  if (!button) return;

  if (isSignedIn) {
    button.selected = !button.selected;
    toast(
      button.selected
        ? 'Item added to favorites'
        : 'Item removed from favorites'
    );
    return;
  }

  if (!isImmediateSupported) {
    await redirect('/passkey-form-autofill?r=/passive-ui-mode');
    return;
  }

  if (isAuthenticating) return;
  isAuthenticating = true;

  try {
    loading.start();
    const user = await authenticate({ui_mode: 'immediate'});
    if (user && typeof user === 'object') {
      setSignedInState(user);
      button.selected = true;
      toast('Signed in and added item to favorites');
    } else {
      throw new Error('User is not found.');
    }
  } catch (error: any) {
    console.error(error);
    if (error.name === 'NotAllowedError') {
      await redirect('/passkey-form-autofill?r=/passive-ui-mode');
    } else if (error.name !== 'AbortError') {
      toast(error.message);
    }
  } finally {
    loading.stop();
    isAuthenticating = false;
  }
});

void initPassiveSignIn();
