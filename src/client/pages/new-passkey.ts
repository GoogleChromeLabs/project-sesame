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
import {$, redirect, toast} from '~project-sesame/client/helpers/index';
import {
  capabilities,
  registerCredential,
} from '~project-sesame/client/helpers/publickey';

const createPasskeyBtn = $('#create-passkey-btn') as HTMLButtonElement;

/**
 * Registers the first passkey for the account being signed up. The previous
 * step has already put the session into the sign-up state, so the server
 * creates the account and signs the user in once the passkey is registered.
 */
createPasskeyBtn.addEventListener('click', async () => {
  createPasskeyBtn.disabled = true;
  // Registration requests a platform authenticator by default. If none is
  // available, allow any authenticator (a security key or a phone) instead so
  // the sign-up can still complete without a password.
  const nonPlatform = !capabilities?.userVerifyingPlatformAuthenticator;

  try {
    await registerCredential(nonPlatform);
    await redirect('/home');
  } catch (e: any) {
    createPasskeyBtn.disabled = false;
    if (e?.name === 'InvalidStateError') {
      // A passkey for this account already exists on the authenticator.
      toast('A passkey already exists for this device.');
    } else if (e?.name === 'NotAllowedError') {
      // The user dismissed the passkey dialog. Let them try again.
      toast('Passkey creation was canceled. Try again when you are ready.');
    } else {
      console.error(e);
      toast(e?.error || e?.message || 'Failed to create a passkey.');
    }
  }
});
