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
import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { Users } from '../libs/users';
import { csrfCheck, sessionCheck } from './common';

/**
 * Check username, create a new account if it doesn't exist.
 * Set a `username` in the session.
 **/
router.post('/username', async (
  req: Request,
  res: Response
) => {
  const { username } = <{ username: string }>req.body;

  try {
     // Only check username, no need to check password as this is a mock
    if (Users.isValidUsername(username)) {
      // See if account already exists
      let user = await Users.findByUsername(username);
      // If user entry is not created yet, create one
      if (!user) {
        user = await Users.create(username);
      }
      // Set username in the session
      req.session.username = username;

      return res.json(user);
    } else {
      throw new Error('Invalid username');
    }
  } catch (error: any) {
    console.error(error);
    return res.status(400).send({ error: error.message });
  }
});

/**
 * Verifies user credential and let the user sign-in.
 * No preceding registration required.
 * This only checks if `username` is not empty string and ignores the password.
 **/
router.post('/password', async (
  req: Request,
  res: Response
) => {
  if (!req.body.password) {
    return res.status(401).json({ error: 'Enter at least one random letter.' });
  }
  const user = await Users.findByUsername(req.session.username);

  if (!user) {
    return res.status(401).json({ error: 'Enter username first.' });
  }

  req.session['signed-in'] = 'yes';

  // Set a login status using the Login Status API
  res.set('Set-Login', 'logged-in');

  return res.json(user);
});

/**
 * Response with user information.
 */
router.post('/userinfo', csrfCheck, sessionCheck, (
  req: Request,
  res: Response
) => {
  const { user } = res.locals;
  return res.json(user);
});

/**
 * Update the user's display name.
 */
router.post('/updateDisplayName', csrfCheck, sessionCheck, async (
  req: Request,
  res: Response
) => {
  const { newName } = req.body;
  if (newName) {
    const { user } = res.locals;
    user.displayName = newName;
    await Users.update(user);
    return res.json(user);
  } else {
    return res.status(400);
  }
});

/**
 * Sign out the user.
 */
router.get('/signout', (
  req: Request,
  res: Response
) => {
  // Remove the session
  req.session.destroy(() => {})

  // Set a login status using the Login Status API
  res.set('Set-Login', 'logged-out');

  // Redirect to `/`
  return res.redirect(307, '/');
});

export { router as auth };
