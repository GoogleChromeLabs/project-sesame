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

import { Request, Response, NextFunction } from "express";
import session from "express-session";
import { FirestoreStore } from "@google-cloud/connect-firestore";
import { getTime } from "./common.js";
import { store, config } from "../config.js";
import { User } from "../libs/users.js";

export enum SignInStatus {
  Unregistered = 0,
  SignedOut = 1,
  SigningIn = 2,
  SignedIn = 3,
  RecentlySignedIn = 4,
}

/**
 * Checks session cookie.
 * If the session does not contain `signed-in` or a username, consider the user is not signed in.
 * If the user is signed in, put the user object in `res.locals.user`.
 **/
export async function sessionCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> {
  res.locals.signin_status = getSignInStatus(req, res);
  if (res.locals.signin_status >= SignInStatus.SigningIn) {
    res.locals.username = getUsername(req, res);
  }
  if (res.locals.signin_status >= SignInStatus.SignedIn) {
    res.locals.user = getSessionUser(req, res);
  }
  return next();
}

export async function apiFilter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> {
  res.locals.signin_status = getSignInStatus(req, res);
  if (res.locals.signin_status === SignInStatus.SignedOut) {
    return res.status(401).json({ error: "not signed in." });
  }
  if (res.locals.signin_status >= SignInStatus.SigningIn) {
    res.locals.username = getUsername(req, res);
  }
  if (res.locals.signin_status >= SignInStatus.SignedIn) {
    res.locals.user = getSessionUser(req, res);
  }
  return next();
}

export function initializeSession() {
  return session({
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: false,
    proxy: true,
    store: new FirestoreStore({
      dataset: store,
      kind: "sessions",
    }),
    cookie: {
      path: "/",
      httpOnly: true,
      secure: !config.is_localhost, // `false` on localhost
      maxAge: config.long_session_duration,
    },
  });
}

export function getSignInStatus(req: Request, res: Response): SignInStatus {
  const { username, signed_in, last_signedin_at, user } = req.session;

  // TODO: Think about strict conditions and patterns of whether a user is signed in.

  if (!username) {
    // The user is signed out.
    return SignInStatus.SignedOut;
  }
  if (!signed_in) {
    // The user is signing in, but not signed in yet.
    return SignInStatus.SigningIn;
  }
  if (
    !last_signedin_at ||
    last_signedin_at < getTime(-config.short_session_duration)
  ) {
    // The user is signed in, but exceeds the short session duration (within the long session duration).
    return SignInStatus.SignedIn;
  }
  // The user is signed in, and within the short session duration.
  return SignInStatus.RecentlySignedIn;
}

/**
 * Sets the challenge value for the session.
 * If the challenge is not provided, a random challenge value is generated.
 * 
 * @param challenge - The challenge value to set (optional)
 * @param req - The request object
 * @param res - The response object
 * @returns The challenge value that was set
 */
export function setChallenge(
  challenge: string = "",
  req: Request,
  res: Response
): string {
  if (challenge === "") {
    challenge = Math.floor(Math.random() * 10e10).toString();
  }
  req.session.challenge = challenge;
  return challenge;
}

export function getChallenge(req: Request, res: Response): string | undefined {
  return req.session.challenge;
}

export function deleteChallenge(req: Request, res: Response): void {
  delete req.session.challenge;
  return;
}

export function setUsername(
  username: string,
  req: Request,
  res: Response
): void {
  if (!username) {
    throw new Error("Invalid username.");
  }
  req.session.username = username;
  return;
}

export function getUsername(req: Request, res: Response): string | undefined {
  return req.session.username;
}

export function setSessionUser(user: User, req: Request, res: Response): void {
  deleteChallenge(req, res);

  // TODO: Do we really need this check?
  if (req.session.username !== undefined && req.session.username !== user.username) {
    throw new Error("The user is trying to sign in with a wrong username.");
  }
  req.session.username = user.username;
  req.session.signed_in = true;
  req.session.last_signedin_at = getTime();
  req.session.user = user;

  // Set a login status using the Login Status API
  res.set("Set-Login", "logged-in");
  return;
}

export function getSessionUser(
  req: Request,
  res: Response
): User {
  if (res.locals.signin_status < SignInStatus.SignedIn || !req.session.user) {
    throw new Error('User is not signed in.');
  }
  return req.session.user;
}

export function signOut(req: Request, res: Response) {
  // Destroy the session
  req.session.destroy(() => {});

  // Set a login status using the Login Status API
  res.set("Set-Login", "logged-out");

  // Redirect to the original entrance.
  return res.redirect(307, getEntrancePath(req, res));
}

export function setEntrancePath(req: Request, res: Response) {
  req.session.entrance = req.path;
  return;
}

export function getEntrancePath(req: Request, res: Response): string {
  return req.session.entrance || '/';
}
