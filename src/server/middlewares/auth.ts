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
  generatePasskeyUserId,
  Users,
  SignUpUser,
} from '~project-sesame/server/libs/users.ts';
import {
  UserSignInStatus,
  apiAclCheck,
  ApiType,
  setSignedIn, // Keeping this for now as it handles headers too
  setSignedOut, // Keeping this for now as it handles headers too
} from '~project-sesame/server/libs/session.ts';
import { SessionService } from '~project-sesame/server/libs/session.ts';
import {csrfCheck} from '~project-sesame/server/middlewares/common.ts';

const router = Router();

router.use(csrfCheck);

/**
 * Start creating a new user
 * @swagger
 * /auth/new-user:
 *   post:
 *     summary: Create a new user
 *     description: Starts the registration process for a new user.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *               displayName:
 *                 type: string
 *     responses:
 *       200:
 *         description: User created successfully
 *       400:
 *         description: Username invalid or taken
 */
router.post(
  '/new-user',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response): Promise<void> => {
    const {username, displayName = ''} = req.body;

    // TODO: Use Captcha to block bots.

    try {
      // TODO: Validate the display name
      const trimmedDisplayName = displayName.trim();

      // Only check username, no need to check password as this is a mock
      if (Users.isValidUsername(username)) {
        // See if account already exists
        const user = await Users.findByUsername(username);

        if (user) {
          // User already exists
          res
            .status(400)
            .send({error: 'The username is already taken.'});
          return;
        }

        const passkeyUserId = generatePasskeyUserId();

        // Set username in the session
        new SessionService(req.session).setSigningUp({
          username,
          displayName: trimmedDisplayName,
          passkeyUserId,
        });

        res.json({});
        return;
      } else {
        res.status(400).send({ error: 'Invalid username.' });
        return;
      }
    } catch (error: any) {
      console.error(error);
      res.status(400).send({ error: error.message });
      return;
    }
  }
);

/**
 * Check if the username exists and initiate sign-in.
 * @swagger
 * /auth/username:
 *   post:
 *     summary: Initiate sign-in with username
 *     description: Checks if a username exists and sets it in the session to begin the sign-in process.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Username accepted
 *       400:
 *         description: Invalid username
 */
router.post(
  '/username',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response): Promise<void> => {
    const {username} = <{username: string}>req.body;

    try {
      // Only check username, no need to check password as this is a mock
      if (Users.isValidUsername(username)) {
        // See if account already exists
        const user = await Users.findByUsername(username);

        // TODO: Examine if notifying user that the username doesn't exist is a good idea.

        // Set username in the session
        new SessionService(req.session).setSigningIn(username);

        res.json({});
        return;
      } else {
        throw new Error('Invalid username');
      }
    } catch (error: any) {
      console.error(error);
      res.status(400).send({ error: error.message });
      return;
    }
  }
);

// TODO: This part is not really worked on yet
/**
 * Create a new user with username and password.
 * @swagger
 * /auth/new-username-password:
 *   post:
 *     summary: Create user with password
 *     description: Registers a new user with a username and password.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password1
 *               - password2
 *             properties:
 *               username:
 *                 type: string
 *               displayName:
 *                 type: string
 *               password1:
 *                 type: string
 *               password2:
 *                 type: string
 *     responses:
 *       200:
 *         description: User created and signed in
 *       400:
 *         description: Invalid input or username taken
 *       401:
 *         description: Failed to sign in
 */
router.post(
  '/new-username-password',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response): Promise<void> => {
    const {username, displayName, password1, password2} = req.body;

    if (!Users.isValidUsername(username)) {
      res.status(400).json({ error: 'Invalid username' });
      return;
    } else if (!Users.isValidPassword(password1) || password1 !== password2) {
      res.status(400).json({ error: 'Invalid password' });
      return;
    }

    // See if account already exists
    const existingUser = await Users.findByUsername(username);
    if (existingUser) {
      // User already exists
      res.status(400).send({ error: 'The username is already taken.' });
      return;
    }

    const user: SignUpUser = {
      username,
      displayName,
      password: password1,
    };

    try {
      const newUser = await Users.create(username, user);
      if (newUser) {
        // Set the user as a signed in status
        setSignedIn(newUser, req, res);

        res.json(newUser);
        return;
      }
    } catch (e: any) {
      console.error(e);
      res.status(400).send({ error: e.message });
      return;
    }

    res.status(401).json({ error: 'Failed to sign in.' });
  }
);

/**
 * Set a password for a new user during sign-up.
 * @swagger
 * /auth/new-password:
 *   post:
 *     summary: Set new user password
 *     description: Sets the password for a user currently in the sign-up process.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password set and user signed in
 *       401:
 *         description: Invalid password or session state
 */
router.post(
  '/new-password',
  apiAclCheck(ApiType.SigningUp),
  async (req: Request, res: Response): Promise<void> => {
    const {password} = req.body;
    const {username} = res.locals;
    const user = new SessionService(req.session).getSigningUp();

    // TODO: Validate entered parameter.
    // TODO: Validate the password format
    if (!Users.isValidPassword(password)) {
      res.status(401).json({ error: 'Invalid password.' });
      return;
    }

    if (username) {
      if (!user) {
        res.status(401).json({ error: 'Failed to sign up.' });
        return;
      }
      user.password = password;

      const newUser = await Users.create(username, user);
      if (newUser) {
        // Set the user as a signed in status
        setSignedIn(newUser, req, res);

        res.json(newUser);
        return;
      }
    }

    res.status(401).json({ error: 'Failed to sign in.' });
  }
);

/**
 * Verifies user credential and let the user sign-in.
 * No preceding registration required.
 * This only checks if `username` is not empty string and ignores the password.
 * @swagger
 * /auth/password:
 *   post:
 *     summary: Sign in with password
 *     description: Verifies password for the user in the current session context.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signed in successfully
 *       401:
 *         description: Invalid password or failed to sign in
 */
router.post(
  '/password',
  apiAclCheck(ApiType.FirstCredential),
  async (req: Request, res: Response): Promise<void> => {
    const {password} = req.body;
    const {username} = res.locals;

    // TODO: Validate entered parameter.
    if (!Users.isValidPassword(password)) {
      res.status(401).json({ error: 'Invalid password.' });
      return;
    }

    if (username) {
      const user = await Users.validatePassword(username, password);
      if (user) {
        // Set the user as a signed in status
        setSignedIn(user, req, res);

        res.json(user);
        return;
      }
    }
    res.status(401).json({ error: 'Failed to sign in.' });
  }
);

/**
 * Sign in with username and password.
 * @swagger
 * /auth/username-password:
 *   post:
 *     summary: Sign in with username and password
 *     description: Authenticates a user using their username and password.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signed in successfully
 *       401:
 *         description: Failed to sign in
 */
router.post(
  '/username-password',
  apiAclCheck(ApiType.SignIn),
  async (req: Request, res: Response): Promise<void> => {
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

        res.json(user);
        return;
      }
    }

    res.status(401).json({ error: 'Failed to sign in.' });
  }
);

/**
 * Change the current user's password.
 * @swagger
 * /auth/password-change:
 *   post:
 *     summary: Change password
 *     description: Updates the password for the currently signed-in user.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - new-password1
 *               - new-password2
 *             properties:
 *               new-password1:
 *                 type: string
 *               new-password2:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Passwords do not match or are invalid
 *       401:
 *         description: User not signed in
 */
router.post(
  '/password-change',
  apiAclCheck(ApiType.Sensitive),
  async (req: Request, res: Response): Promise<void> => {
    const newPassword1 = req.body['new-password1'];
    const newPassword2 = req.body['new-password2'];

    if (newPassword1 === '') {
      res
        .status(400)
        .json({error: 'Enter at least * characters for the password.'});
      return;
    }
    if (newPassword1 !== newPassword2) {
      res.status(400).json({ error: 'New passwords do not match.' });
      return;
    }

    // TODO: Validate the password format
    // TODO: Update the password in the database

    res.json({});
  }
);

/**
 * Response with user information.
 * @swagger
 * /auth/userinfo:
 *   post:
 *     summary: Get user info
 *     description: Retrieves information about the currently signed-in user.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: User information
 *       401:
 *         description: User not signed in
 */
router.post(
  '/userinfo',
  apiAclCheck(ApiType.SignedIn),
  (req: Request, res: Response): void => {
    if (res.locals.signin_status < UserSignInStatus.SignedIn) {
      // If the user has not signed in, return an error.
      res.status(401).json({ error: 'The user needs to be signed in.' });
      return;
    }
    const {user} = res.locals;
    res.json(user);
  }
);

/**
 * Update the user's display name.
 * @swagger
 * /auth/updateDisplayName:
 *   post:
 *     summary: Update display name
 *     description: Updates the display name for the currently signed-in user.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newName
 *             properties:
 *               newName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Missing new name
 *       401:
 *         description: User not signed in
 */
router.post(
  '/updateDisplayName',
  apiAclCheck(ApiType.SignedIn),
  async (req: Request, res: Response): Promise<void> => {
    if (res.locals.signin_status < UserSignInStatus.SignedIn) {
      // If the user has not signed in, return an error.
      res.status(401).json({ error: 'The user needs to be signed in.' });
      return;
    }
    const {newName} = req.body;
    if (newName) {
      const {user} = res.locals;
      user.displayName = newName;
      await Users.update(user);
      res.json(user);
      return;
    } else {
      res.sendStatus(400);
      return;
    }
  }
);

/**
 * Delete the current user's account.
 * @swagger
 * /auth/delete-user:
 *   post:
 *     summary: Delete user account
 *     description: Deletes the currently signed-in user's account. Requires recent authentication.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         description: User not signed in or session too old
 */
router.post(
  '/delete-user',
  apiAclCheck(ApiType.Sensitive),
  async (req: Request, res: Response): Promise<void> => {
    if (res.locals.signin_status < UserSignInStatus.RecentlySignedIn) {
      // If the user has not signed in recently enough, return an error.
      res.status(401).json({ error: 'The user needs to reauthenticate.' });
      return;
    }
    const {user} = res.locals;
    await Users.delete(user.id);

    setSignedOut(req, res);

    res.json({});
  }
);

export {router as auth};
