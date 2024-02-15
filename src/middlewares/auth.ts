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
import express, { Request, Response } from "express";
const router = express.Router();
import { Users } from "../libs/users.js";
import {
  sessionCheck,
  signOut,
  setUsername,
  getUsername,
  SignInStatus,
  setSessionUser,
  getEntrancePath,
} from "./session.js";
import { csrfCheck } from "./common.js";

/**
 * Check username, create a new account if it doesn't exist.
 * Set a `username` in the session.
 **/
router.post("/username", async (req: Request, res: Response) => {
  const { username } = <{ username: string }>req.body;

  try {
    // Only check username, no need to check password as this is a mock
    if (Users.isValidUsername(username)) {
      // See if account already exists
      let user = await Users.findByUsername(username);

      // TODO: Examine if notifying user that the username doesn't exist is a good idea.

      // Set username in the session
      setUsername(username, req, res);

      return res.json({});
    } else {
      throw new Error("Invalid username");
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
router.post("/password", sessionCheck, async (req: Request, res: Response) => {
  // TODO: Validate entered parameter.
  if (!req.body.password) {
    return res.status(401).json({ error: "Enter at least one random letter." });
  }
  if (res.locals.signin_status !== SignInStatus.SigningIn) {
    return res
      .status(400)
      .json({ error: "The user is not signing in or already signed in." });
  }
  const username = getUsername(req, res);
  if (!username) {
    return res.redirect(307, getEntrancePath(req, res));
  }

  let user = await Users.findByUsername(username);

  // TODO: Compare the entered password against the registered password.
  // This is skipped for now.

  if (!user) {
    user = await Users.create(username);
  }

  // Set the user as a signed in status
  setSessionUser(user, req, res);

  return res.json(user);
});

/**
 * Response with user information.
 */
router.post(
  "/userinfo",
  csrfCheck,
  sessionCheck,
  (req: Request, res: Response) => {
    const { user } = res.locals;
    return res.json(user);
  }
);

/**
 * Update the user's display name.
 */
router.post(
  "/updateDisplayName",
  csrfCheck,
  sessionCheck,
  async (req: Request, res: Response) => {
    const { newName } = req.body;
    if (newName) {
      const { user } = res.locals;
      user.displayName = newName;
      await Users.update(user);
      return res.json(user);
    } else {
      return res.status(400);
    }
  }
);

export { router as auth };
