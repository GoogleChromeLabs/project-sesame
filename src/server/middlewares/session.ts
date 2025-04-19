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

import {Request, Response, NextFunction} from 'express';
import {RequestHandlerParams} from 'express-serve-static-core';
import session from 'express-session';
import {FirestoreStore} from '@google-cloud/connect-firestore';
import {getTime} from '~project-sesame/server/middlewares/common.ts';
import {store, config} from '~project-sesame/server/config.ts';
import {User} from '~project-sesame/server/libs/users.ts';
import {generateRandomString} from '~project-sesame/server/libs/helpers.ts';

export enum UserSignInStatus {
  Unregistered = 0,
  SignedOut = 1,
  SigningUp = 2,
  SigningIn = 3,
  SignedIn = 4,
  RecentlySignedIn = 5,
}

// ACL requirement for a page
export enum PageType {
  NoAuth = 0, // No authentication is required
  SignUp = 1, // This is a sign-up page
  SignUpCredential = 2, // The user must be signing up
  SignIn = 3, // This is a sign-in page
  SignedIn = 4, // The user must be signed in
  Sensitive = 5, // The user must be recently signed in
  Reauth = 6, // The user must be signed in and requires reauthentication
}

// ACL requirement for an API
export enum ApiType {
  NoAuth = 0, // No authentication is required
  PasskeyRegistration = 1, // The user is either signing-up or signed-in
  Identifier = 2, // The user is about to sign-up
  SignUpCredential = 3, // The user is in the middle of signing up
  Authentication = 4, // The user is about to sign in with a username and a credential
  FirstCredential = 5, // The user is about to sign in
  SecondCredential = 6, // The user is about to sign in
  SignedIn = 7, // The user must be signed in
  Sensitive = 8, // The user must be recently signed in
}

export function getSignInStatus(req: Request, res: Response): UserSignInStatus {
  console.log(req.session);
  const {username, signed_in, last_signedin_at, user, passkey_user_id} =
    req.session;

  // TODO: Simplify this logic

  if (!username) {
    // The user is signed out.
    return UserSignInStatus.SignedOut;
  } else if (username && passkey_user_id) {
    // The user is signing up.
    return UserSignInStatus.SigningUp;
  } else if (!signed_in) {
    // The user is signing in, but not signed in yet.
    return UserSignInStatus.SigningIn;
  } else if (
    !last_signedin_at ||
    last_signedin_at < getTime(-config.short_session_duration)
  ) {
    // The user is signed in, but exceeds the short session duration (within the long session duration).
    return UserSignInStatus.SignedIn;
  }
  // The user is signed in, and within the short session duration.
  return UserSignInStatus.RecentlySignedIn;
}

export function pageAclCheck(pageType: PageType): RequestHandlerParams {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (pageType === PageType.SignUp) {
      if (res.locals.signin_status >= UserSignInStatus.SignedIn) {
        // If the user is signed in, redirect to `/home`.
        return res.redirect(307, '/home');
      }
    } else if (pageType === PageType.SignUpCredential) {
      if (res.locals.signin_status < UserSignInStatus.SigningUp) {
        // If the user has not started signing in, redirect to the original entrance.
        return res.redirect(307, '/signup-form');
      }
      if (res.locals.signin_status >= UserSignInStatus.SignedIn) {
        // If the user is signed in, redirect to `/home`.
        return res.redirect(307, '/home');
      }
      res.locals.username = getEphemeralUsername(req, res);
    } else if (pageType === PageType.SignIn) {
      if (res.locals.signin_status >= UserSignInStatus.SignedIn) {
        const queryParams = req.query;
        const search = new URLSearchParams(
          queryParams as Record<string, string>
        );
        // If the user is already signed in...
        const entrance = getEntrancePath(req, res);
        const url = new URL(config.origin);
        if (entrance === '/signin-form') {
          // Redirect to `/password`.
          url.pathname = '/password';
        } else {
          // Redirect to `/passkey-reauth`.
          url.pathname = '/passkey-reauth';
        }
        url.search = search.toString();
        return res.redirect(307, url.pathname + url.search);
      }
      setEntrancePath(req, res);
    } else if (pageType === PageType.Reauth) {
      if (res.locals.signin_status < UserSignInStatus.SigningIn) {
        // If the user is not signing in, redirect to the original entrance.
        return res.redirect(307, getEntrancePath(req, res));
      }
      if (res.locals.signin_status >= UserSignInStatus.RecentlySignedIn) {
        // If the user is recently signed in, redirect to `/home`.
        return res.redirect(307, '/home');
      }
    } else if (pageType === PageType.SignedIn) {
      if (res.locals.signin_status < UserSignInStatus.SignedIn) {
        // If the user has not signed in yet, redirect to the original entrance.
        return res.redirect(307, getEntrancePath(req, res));
      }
      res.locals.user = getSessionUser(req, res);
    } else if (pageType === PageType.Sensitive) {
      if (res.locals.signin_status < UserSignInStatus.RecentlySignedIn) {
        // Construct the redirect path as `r`
        const url = new URL(getEntrancePath(req, res), config.origin);
        const search = new URLSearchParams({r: req.originalUrl});
        url.search = search.toString();
        console.log(url.toString());

        // If the user has not signed in yet, redirect to the original entrance.
        return res.redirect(307, url.pathname + url.search);
      }
      res.locals.user = getSessionUser(req, res);
    }
    return next();
  };
}

export function apiAclCheck(apiType: ApiType): RequestHandlerParams {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    // The user is signing up: `/auth/new_user`
    if (apiType === ApiType.Identifier) {
      if (res.locals.signin_status >= UserSignInStatus.SignedIn) {
        // If the user is already signed in, this is an invalid access
        return res.status(400).json({error: 'The user is already signed in.'});
      }

      // The user is entering a credential for signing up: `/auth/username-password`
    } else if (apiType === ApiType.SignUpCredential) {
      if (res.locals.signin_status !== UserSignInStatus.SigningUp) {
        // Unless the user is signing up, this is an invalid access
        return res.status(400).json({error: 'The user is already signed in.'});
      }
      res.locals.username = getEphemeralUsername(req, res);
    } else if (apiType === ApiType.Authentication) {
      if (res.locals.signin_status >= UserSignInStatus.SignedIn) {
        // If the user is already signed in, this is reauth
        res.locals.username = getEphemeralUsername(req, res);
        res.locals.user = getSessionUser(req, res);
      }
    } else if (apiType === ApiType.FirstCredential) {
      if (res.locals.signin_status < UserSignInStatus.SigningIn) {
        return res.status(400).json({error: 'The user is not signing in.'});
      }
      res.locals.username = getEphemeralUsername(req, res);
    } else if (apiType === ApiType.SignedIn) {
      if (res.locals.signin_status < UserSignInStatus.SignedIn) {
        // If the user is not signed in, return an error.
        return res.status(401).json({error: 'The user is not signed in.'});
      }
      res.locals.username = getEphemeralUsername(req, res);
      res.locals.user = getSessionUser(req, res);
    } else if (apiType === ApiType.Sensitive) {
      if (res.locals.signin_status < UserSignInStatus.SignedIn) {
        // If the user is not signed in, return an error.
        return res.status(401).json({error: 'The user is not signed in.'});
      }
      if (res.locals.signin_status < UserSignInStatus.RecentlySignedIn) {
        // If the user has not authenticated recently, request a reauth.
        return res.status(401).json({error: 'Insufficient privilege.'});
      }
      res.locals.username = getEphemeralUsername(req, res);
      res.locals.user = getSessionUser(req, res);
    } else if (apiType === ApiType.PasskeyRegistration) {
      if (res.locals.signin_status < UserSignInStatus.SigningUp) {
        res
          .status(400)
          .json({error: 'Invalid request. User is not signing up.'});
      }
      if (res.locals.signin_status === UserSignInStatus.SigningUp) {
        res.locals.username = getEphemeralUsername(req, res);
      }
      if (res.locals.signin_status >= UserSignInStatus.SignedIn) {
        res.locals.user = getSessionUser(req, res);
      }
    }
    return next();
  };
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
  // If the user is signing up, signing in, signed in or recently signed in:
  if (res.locals.signin_status >= UserSignInStatus.SigningUp) {
    res.locals.username = getEphemeralUsername(req, res);
  }
  // If the user is signed in or recently signed in:
  if (res.locals.signin_status >= UserSignInStatus.SignedIn) {
    res.locals.user = getSessionUser(req, res);
  }
  return next();
}

export function initializeSession() {
  return session({
    secret: config.secret,
    resave: true,
    saveUninitialized: false,
    proxy: true,
    store: new FirestoreStore({
      dataset: store,
      kind: 'sessions',
    }),
    cookie: {
      path: '/',
      httpOnly: true,
      secure: !config.is_localhost, // `false` on localhost
      maxAge: config.long_session_duration,
    },
  });
}

export function getDeviceId(req: Request, res: Response): string {
  let {device_id} = req.cookies;

  if (!device_id) {
    device_id = generateRandomString();
    res.cookie('device_id', device_id, {
      path: '/',
      httpOnly: true,
      secure: !config.is_localhost, // `false` on localhost
      maxAge: config.forever_cookie_duration,
    });
  }
  return device_id;
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
  req: Request,
  res: Response,
  challenge?: string
): string {
  challenge ??= generateRandomString();
  console.log('set challenge:', challenge);
  req.session.challenge = challenge;
  return challenge;
}

export function getChallenge(req: Request, res: Response): string | undefined {
  console.log('get challenge:', req.session.challenge);
  return req.session.challenge;
}

export function deleteChallenge(req: Request, res: Response): void {
  console.log('delete challenge:', req.session.challenge);
  delete req.session.challenge;
  return;
}

export function setEphemeralPasskeyUserId(
  passkey_user_id: string,
  req: Request,
  res: Response
): void {
  if (!passkey_user_id) {
    throw new Error('Invalid passkey_user_id.');
  }
  req.session.passkey_user_id = passkey_user_id;
  return;
}

export function getEphemeralPasskeyUserId(
  req: Request,
  res: Response
): string | undefined {
  if (req.session.passkey_user_id) {
    return req.session.passkey_user_id;
  } else {
    // TODO: Generate a passkey user id
    console.log('TODO: passkey user id does not exist yet.');
    return undefined;
  }
}

export function deleteEpehemeralPasskeyUserId(
  req: Request,
  res: Response
): void {
  delete req.session.passkey_user_id;
  return;
}

// export function setSigningUp(req: Request, res: Response): void {
//   req.session.signing_up = true;
//   return;
// }

// export function unsetSigningUp(req: Request, res: Response): void {
//   delete req.session.signing_up;
//   return;
// }

export function setEphemeralUsername(
  username: string,
  req: Request,
  res: Response
): void {
  if (!username) {
    throw new Error('Invalid username.');
  }
  req.session.username = username;
  return;
}

export function getEphemeralUsername(
  req: Request,
  res: Response
): string | undefined {
  return req.session.username;
}

export function setSessionUser(user: User, req: Request, res: Response): void {
  deleteChallenge(req, res);
  deleteEpehemeralPasskeyUserId(req, res);

  req.session.username = user.username;
  req.session.signed_in = true;
  req.session.last_signedin_at = getTime();
  req.session.user = user;

  // Set a login status using the Login Status API
  res.set('Set-Login', 'logged-in');
  return;
}

export function getSessionUser(req: Request, res: Response): User {
  if (
    res.locals.signin_status < UserSignInStatus.SignedIn ||
    !req.session.user
  ) {
    throw new Error('User is not signed in.');
  }
  return req.session.user;
}

export function signOut(req: Request, res: Response) {
  const entrancePath = getEntrancePath(req, res);

  // Destroy the session
  req.session.destroy(() => {});

  // Set a login status using the Login Status API
  res.set('Set-Login', 'logged-out');

  // Redirect to the original entrance.
  return res.redirect(307, entrancePath);
}

/**
 * Remember from where the user has entered the website. This is to prevent
 * users from entering unrelated sign-in flows, as Project Sesame's goal is to
 * demonstrate a specific sign-in flow by linking to the enterance, by making
 * sure the user is brought back to the original entrance when they sign out.
 * @param req
 * @param res
 * @param path optional entrance path in string. Pass it when you want to
 * specify a path that is not the same as where the user is.
 * @returns
 */
export function setEntrancePath(
  req: Request,
  res: Response,
  path?: string
): void {
  req.session.entrance = path || req.path;
  return;
}

/**
 * Recall from where the user has entered the website.
 * @param req
 * @param res
 * @returns
 */
export function getEntrancePath(req: Request, res: Response): string {
  return req.session?.entrance || '/';
}
