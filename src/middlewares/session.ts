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

import { getTime } from "./common.js";
import { Request, Response, NextFunction } from "express";
import session from "express-session";
import { FirestoreStore } from "@google-cloud/connect-firestore";
import { Users } from "../libs/users.js";
import { store, config } from "../config.js";

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
  if (!isSignedIn(req, res)) {
    return res.status(401).json({ error: "not signed in." });
  }
  const user = await Users.findByUsername(req.session.username);
  if (!user) {
    return res.status(401).json({ error: "user not found." });
  }
  res.locals.user = user;
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
      secure: !config.is_localhost,
      maxAge: config.long_session_duration, // 1 year
    },
  });
}

export function signedIn(username: string, req: Request, res: Response) {
  if (req.session.username !== undefined && req.session.username !== username) {
    throw new Error("Trying to sign in with a wrong username.");
  }
  req.session.username = username;
  req.session.signed_in = true;
  req.session.last_signedin_at = getTime();

  // Set a login status using the Login Status API
  res.set("Set-Login", "logged-in");
}

export function signOut(nextPath: string, req: Request, res: Response) {
  // Destroy the session
  req.session.destroy(() => {});

  // Set a login status using the Login Status API
  res.set("Set-Login", "logged-out");

  // Redirect to `/`
  return res.redirect(307, nextPath);
}

export function isSignedIn(req: Request, res: Response): boolean {
  // if (!req.session.username || req.session['signed-in'] !== 'yes') {
  if (!req.session.username || !req.session.signed_in) {
    // If user is not signed in, redirect to `/`.
    return false;
  }
  return true;
}

export function isRecentlySignedIn(req: Request, res: Response): boolean {
  // if (!req.session.username || req.session['signed-in'] !== 'yes') {
  if (!req.session.username || !req.session.signed_in) {
    // If user is not signed in, return false.
    return false;
  }
  if (
    !req.session.last_signedin_at ||
    req.session.last_signedin_at < getTime(-config.short_session_duration)
  ) {
    // If the last sign-in was older than the short session duration, return false.
    return false;
  }
  return true;
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
