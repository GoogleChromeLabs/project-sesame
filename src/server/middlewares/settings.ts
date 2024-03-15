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
import {Router, Request, Response} from 'express';

import {Users, generatePasskeyUserId} from '~project-sesame/server/libs/users.ts';
import {
  sessionCheck,
  signOut,
  setUsername,
  getUsername,
  SignInStatus,
  setSessionUser,
  getEntrancePath,
  setPasskeyUserId,
} from '~project-sesame/server/middlewares/session.ts';
import {csrfCheck} from '~project-sesame/server/middlewares/common.ts';

const router = Router();

router.get('/', sessionCheck, (req: Request, res: Response) => {
  if (res.locals.signin_status < SignInStatus.SignedIn) {
    // If the user has not signed in yet, redirect to the original entrance.
    return res.redirect(307, getEntrancePath(req, res));
  }
  // Temporarily show the home screen
  // TODO: Create a settings page UI
  return res.render('home.html', {
    title: 'Settings',
    layout: 'home',
  });
});

router.get('/delete-account', sessionCheck, (req: Request, res: Response) => {
  if (res.locals.signin_status < SignInStatus.SignedIn) {
    // If the user has not signed in yet, redirect to the original entrance.
    return res.redirect(307, getEntrancePath(req, res));
  }
  if (res.locals.signin_status < SignInStatus.RecentlySignedIn) {
    // TODO: What's the best way to reauthenticate the user?
    return res.redirect(307, getEntrancePath(req, res));
  }
  // Temporarily show the home screen
  // TODO: Create a settings page UI
  return res.render('home.html', {
    title: 'Settings',
    layout: 'home',
  });
});

export {router as settings};
