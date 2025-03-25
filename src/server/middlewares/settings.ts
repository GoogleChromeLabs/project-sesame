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

import {
  PageType,
  redirect,
} from '../middlewares/session.ts';

const router = Router();

// There's nothing here.
router.get('/', (req: Request, res: Response) => {
  return res.redirect(307, '/home');
});

router.get('/passkeys', redirect(PageType.Sensitive), (req: Request, res: Response) => {
  return res.render('settings/passkeys.html', {
    title: 'Passkey Management',
  });
});

router.get('/password-change', redirect(PageType.Sensitive), (req: Request, res: Response) => {
  const username = req.session.username;
  return res.render('settings/password-change.html', {
    title: 'Password Change',
    username,
  });
});

router.get('/delete-account', redirect(PageType.Sensitive), (req: Request, res: Response) => {
  return res.render('settings/delete-account.html', {
    title: 'Delete account',
  });
});

export {router as settings};
