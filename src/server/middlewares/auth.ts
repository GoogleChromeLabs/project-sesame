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

import {Users, generatePasskeyUserId} from '../libs/users.ts';
import {
  sessionCheck,
  setEphemeralUsername,
  getEphemeralUsername,
  SignInStatus,
  setSessionUser,
  setEphemeralPasskeyUserId,
} from '../middlewares/session.ts';
import {csrfCheck} from '../middlewares/common.ts';

const router = Router();

/**
 * Start creating a new user
 */
router.post('/new-user', sessionCheck, async (req: Request, res: Response) => {
  const {username} = <{username: string}>req.body;
  // TODO: Use Captcha to block bots.

  try {
    // Only check username, no need to check password as this is a mock
    if (Users.isValidUsername(username)) {
      // See if account already exists
      const user = await Users.findByUsername(username);

      if (user) {
        // User already exists
        return res.status(400).send({error: 'The username is already taken.'});
      }

      // Set username in the session
      // TODO: This needs to be reset to avoid unexpected bug.
      setEphemeralUsername(username, req, res);

      // Generate a new passkey user id
      const passkey_user_id = generatePasskeyUserId();
      // TODO: This needs to be reset to avoid unexpected bug.
      setEphemeralPasskeyUserId(passkey_user_id, req, res);

      return res.json({});
    } else {
      return res.status(400).send({error: 'Invalid username.'});
    }
  } catch (error: any) {
    console.error(error);
    return res.status(400).send({error: error.message});
  }
});

/**
 * Check username, create a new account if it doesn't exist.
 * Set a `username` in the session.
 **/
router.post('/username', async (req: Request, res: Response) => {
  const {username} = <{username: string}>req.body;

  try {
    // Only check username, no need to check password as this is a mock
    if (Users.isValidUsername(username)) {
      // See if account already exists
      const user = await Users.findByUsername(username);

      // TODO: Examine if notifying user that the username doesn't exist is a good idea.

      // Set username in the session
      setEphemeralUsername(username, req, res);

      return res.json({});
    } else {
      throw new Error('Invalid username');
    }
  } catch (error: any) {
    console.error(error);
    return res.status(400).send({error: error.message});
  }
});

/**
 * Verifies user credential and let the user sign-in.
 * No preceding registration required.
 * This only checks if `username` is not empty string and ignores the password.
 **/
router.post('/password', sessionCheck, async (req: Request, res: Response) => {
  if (res.locals.signin_status !== SignInStatus.SigningIn) {
    // If the user is not signing in, return an error.
    return res.status(400).json({error: 'The user is not signing in.'});
  }
  const {password} = req.body;

  // TODO: Validate entered parameter.
  if (!Users.isValidPassword(password)) {
    return res.status(401).json({error: 'Invalid password.'});
  }
  if (res.locals.signin_status < SignInStatus.SigningIn) {
    return res
      .status(400)
      .json({error: 'The user is not signing in.'});
  }
  const username = getEphemeralUsername(req, res);
  if (username) {
    const user = await Users.validatePassword(username, password);
    if (user) {
      // Set the user as a signed in status
      setSessionUser(user, req, res);

      return res.json(user);
    }
  }
  return res.status(401).json({error: 'Failed to sign in.'});
});

router.post('/username-password', sessionCheck, async (req: Request, res: Response) => {
  if (res.locals.signin_status > SignInStatus.SignedOut) {
    // If the user is already signed in, return an error.
    return res.status(400).json({error: 'The user is already signed in.'});
  }

  const {username, password} = req.body;

  // TODO: Verify the current password
  // TODO: Validate the password format
  // TODO: Compare two new passwords
  // TODO: Update the password in the database

  if (username) {
    const user = await Users.validatePassword(username, password);
    if (user) {
      // Set the user as a signed in status
      setSessionUser(user, req, res);

      return res.json(user);
    }
  }

  return res.status(401).json({error: 'Failed to sign in.'});
});

router.post('/password-change', sessionCheck, async (req: Request, res: Response) => {
  if (res.locals.signin_status < SignInStatus.RecentlySignedIn) {
    // If the user is already signed in, return an error.
    return res.status(400).json({error: 'Insufficient privilege.'});
  }
  const newPassword1 = req.body['new-password1'];
  const newPassword2 = req.body['new-password2'];

  if (newPassword1 === '') {
    return res.status(400).json({error: 'Enter at least * characters for the password.'});
   }
   if (newPassword1 !== newPassword2) {
    return res.status(400).json({error: 'New passwords do not match.'});
  }

  // TODO: Validate the password format
  // TODO: Update the password in the database

  return res.json({});
});

/**
 * Response with user information.
 */
router.post(
  '/userinfo',
  csrfCheck,
  sessionCheck,
  (req: Request, res: Response) => {
    if (res.locals.signin_status < SignInStatus.SignedIn) {
      // If the user has not signed in, return an error.
      return res.status(401).json({error: 'The user needs to be signed in.'});
    }
    const {user} = res.locals;
    return res.json(user);
  }
);

/**
 * Update the user's display name.
 */
router.post(
  '/updateDisplayName',
  csrfCheck,
  sessionCheck,
  async (req: Request, res: Response) => {
    if (res.locals.signin_status < SignInStatus.SignedIn) {
      // If the user has not signed in, return an error.
      return res.status(401).json({error: 'The user needs to be signed in.'});
    }
    const {newName} = req.body;
    if (newName) {
      const {user} = res.locals;
      user.displayName = newName;
      await Users.update(user);
      return res.json(user);
    } else {
      return res.status(400);
    }
  }
);

router.post(
  '/delete-user',
  csrfCheck,
  sessionCheck,
  async (req: Request, res: Response) => {
    if (res.locals.signin_status < SignInStatus.RecentlySignedIn) {
      // If the user has not signed in recently enough, return an error.
      return res.status(401).json({error: 'The user needs to reauthenticate.'});
    }
    const {user} = res.locals;
    await Users.delete(user.id);
    return res.json({});
  }
);

export {router as auth};
