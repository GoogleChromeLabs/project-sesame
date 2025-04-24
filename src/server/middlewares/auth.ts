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
  Users,
  generatePasskeyUserId,
} from '~project-sesame/server/libs/users.ts';
import {
  UserSignInStatus,
  setSignedIn,
  setEphemeralPasskeyUserId,
  apiAclCheck,
  ApiType,
  setSigningUp,
  setSigningIn,
  setSignedOut,
} from '~project-sesame/server/middlewares/session.ts';
import {csrfCheck} from '~project-sesame/server/middlewares/common.ts';

const router = Router();

router.use(csrfCheck);

/**
 * Start creating a new user
 */
router.post(
  '/new-user',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response) => {
    const {username} = <{username: string}>req.body;
    // TODO: Use Captcha to block bots.

    try {
      // Only check username, no need to check password as this is a mock
      if (Users.isValidUsername(username)) {
        // See if account already exists
        const user = await Users.findByUsername(username);

        if (user) {
          // User already exists
          return res
            .status(400)
            .send({error: 'The username is already taken.'});
        }

        // Set username in the session
        setSigningUp(username, req, res);

        // // Generate a new passkey user id
        // const passkey_user_id = generatePasskeyUserId();
        // // TODO: This needs to be reset to avoid unexpected bug.
        // setEphemeralPasskeyUserId(passkey_user_id, req, res);

        return res.json({});
      } else {
        return res.status(400).send({error: 'Invalid username.'});
      }
    } catch (error: any) {
      console.error(error);
      return res.status(400).send({error: error.message});
    }
  }
);

/**
 * Check username, create a new account if it doesn't exist.
 * Set a `username` in the session.
 **/
router.post(
  '/username',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response) => {
    const {username} = <{username: string}>req.body;

    try {
      // Only check username, no need to check password as this is a mock
      if (Users.isValidUsername(username)) {
        // See if account already exists
        const user = await Users.findByUsername(username);

        // TODO: Examine if notifying user that the username doesn't exist is a good idea.

        // Set username in the session
        setSigningIn(username, req, res);

        return res.json({});
      } else {
        throw new Error('Invalid username');
      }
    } catch (error: any) {
      console.error(error);
      return res.status(400).send({error: error.message});
    }
  }
);

// TODO: This part is not really worked on yet
router.post(
  '/new-username-password',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response) => {
    const {username, password1, password2} = req.body;

    if (!Users.isValidUsername(username)) {
      return res.status(400).json({error: 'Invalid username'});
    } else if (!Users.isValidPassword(password1) || password1 !== password2) {
      return res.status(400).json({error: 'Invalid password'});
    }

    // TODO: Validate entered parameter.
    // TODO: Validate the password format

    try {
      const user = await Users.validatePassword(username, password1);
      if (user) {
        // Set the user as a signed in status
        setSignedIn(user, req, res);

        return res.json(user);
      }
    } catch (e: any) {
      console.error(e);
      return res.status(400).send({error: e.message});
    }

    return res.status(401).json({error: 'Failed to sign in.'});
  }
);

router.post(
  '/new-password',
  apiAclCheck(ApiType.SigningUp),
  async (req: Request, res: Response) => {
    const {password} = req.body;
    const {username} = res.locals;

    // TODO: Validate entered parameter.
    // TODO: Validate the password format
    if (!Users.isValidPassword(password)) {
      return res.status(401).json({error: 'Invalid password.'});
    }

    if (username) {
      const user = await Users.validatePassword(username, password);
      if (user) {
        // Set the user as a signed in status
        setSignedIn(user, req, res);

        return res.json(user);
      }
    }

    return res.status(401).json({error: 'Failed to sign in.'});
  }
);

/**
 * Verifies user credential and let the user sign-in.
 * No preceding registration required.
 * This only checks if `username` is not empty string and ignores the password.
 **/
router.post(
  '/password',
  apiAclCheck(ApiType.FirstCredential),
  async (req: Request, res: Response) => {
    const {password} = req.body;
    const {username} = res.locals;

    // TODO: Validate entered parameter.
    if (!Users.isValidPassword(password)) {
      return res.status(401).json({error: 'Invalid password.'});
    }

    if (username) {
      const user = await Users.validatePassword(username, password);
      if (user) {
        // Set the user as a signed in status
        setSignedIn(user, req, res);

        return res.json(user);
      }
    }
    return res.status(401).json({error: 'Failed to sign in.'});
  }
);

router.post(
  '/username-password',
  apiAclCheck(ApiType.Authentication),
  async (req: Request, res: Response) => {
    const {username, password} = req.body;

    // TODO: Verify the current password
    // TODO: Validate the password format
    // TODO: Compare two new passwords
    // TODO: Update the password in the database

    if (username) {
      const user = await Users.validatePassword(username, password);
      if (user) {
        // Set the user as a signed in status
        setSignedIn(user, req, res);

        return res.json(user);
      }
    }

    return res.status(401).json({error: 'Failed to sign in.'});
  }
);

router.post(
  '/password-change',
  apiAclCheck(ApiType.Sensitive),
  async (req: Request, res: Response) => {
    const newPassword1 = req.body['new-password1'];
    const newPassword2 = req.body['new-password2'];

    if (newPassword1 === '') {
      return res
        .status(400)
        .json({error: 'Enter at least * characters for the password.'});
    }
    if (newPassword1 !== newPassword2) {
      return res.status(400).json({error: 'New passwords do not match.'});
    }

    // TODO: Validate the password format
    // TODO: Update the password in the database

    return res.json({});
  }
);

/**
 * Response with user information.
 */
router.post(
  '/userinfo',
  apiAclCheck(ApiType.SignedIn),
  (req: Request, res: Response) => {
    if (res.locals.signin_status < UserSignInStatus.SignedIn) {
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
  apiAclCheck(ApiType.SignedIn),
  async (req: Request, res: Response) => {
    if (res.locals.signin_status < UserSignInStatus.SignedIn) {
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
  apiAclCheck(ApiType.Sensitive),
  async (req: Request, res: Response) => {
    if (res.locals.signin_status < UserSignInStatus.RecentlySignedIn) {
      // If the user has not signed in recently enough, return an error.
      return res.status(401).json({error: 'The user needs to reauthenticate.'});
    }
    const {user} = res.locals;
    await Users.delete(user.id);

    setSignedOut(req, res);

    return res.json({});
  }
);

export {router as auth};
