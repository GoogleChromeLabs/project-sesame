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

import { Request, Response, NextFunction } from 'express';
import expressSession from 'express-session';
import { Users } from '../libs/users.js';
import { store } from '../config.js';
import { FirestoreStore } from '@google-cloud/connect-firestore';

export const SessionStore = new FirestoreStore({
  dataset: store,
  kind: 'sessions',
});

export class Session {
  static initialize() {
    return expressSession({
      secret: process.env.SECRET,
      resave: true,
      saveUninitialized: false,
      proxy: true,
      store: SessionStore,
      cookie:{
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'localhost',
        maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
      }
    });
  }

  static sessionCheck(req: Request, res: Response): any {
  }

  static async apiSessionCheck(req: Request, res: Response, next: NextFunction): Promise<any> {
    if (!req.session["signed-in"] || !req.session.username) {
      return res.status(401).json({ error: "not signed in." });
    }
    const user = await Users.findByUsername(req.session.username);
    if (!user) {
      return res.status(401).json({ error: "user not found." });
    }
    res.locals.user = user;
    return next();
  }

  static setChallenge(challenge: string, req: Request, res: Response): void {
    req.session.challenge = challenge;
    return;
  }

  static getChallenge(req: Request, res: Response): string | undefined {
    return req.session.challenge;
  }

  static deleteChallenge(req: Request, res: Response): void {
    delete req.session.challenge;
    return;
  }

  static setUsername(username: string, req: Request, res: Response): void {
    req.session.username = username;
    return;
  }

  static getUsername(req: Request, res: Response): string | undefined {
    return req.session.username;
  }

  static signedIn(username: string, req: Request, res: Response) {
    if (req.session.username !== undefined && req.session.username !== username) {
      throw new Error('Trying to sign in with a wrong username.');
    }
    req.session.username = username;
    req.session["signed-in"] = "yes";

    // Set a login status using the Login Status API
    res.set("Set-Login", "logged-in");
  }

  static signOut(nextPath: string, req: Request, res: Response) {
    // Destroy the session
    req.session.destroy(() => {});

    // Set a login status using the Login Status API
    res.set("Set-Login", "logged-out");

    // Redirect to `/`
    return res.redirect(307, nextPath);
  }
}
