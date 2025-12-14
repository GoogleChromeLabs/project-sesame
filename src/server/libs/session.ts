/*
 * @license
 * Copyright 2025 Google LLC. All rights reserved.
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

import { Session } from 'express-session';
import { User, SignUpUser } from '../libs/users.js';
import { generateRandomString } from '../libs/helpers.js';
import { getTime } from '../middlewares/common.js';
import { config, store } from '../config.js';
import { Request, Response, NextFunction } from 'express';
import { RequestHandlerParams } from 'express-serve-static-core';
import session from 'express-session';
import { CustomFirestoreStore } from '../libs/custom-firestore-session.js';

export enum UserSignInStatus {
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
  SigningUp = 2, // The user must be signing up
  SignIn = 3, // This is a sign-in page
  FirstCredential = 4, // The user has provided the username
  Reauth = 5, // The user must be signed in and requires reauthentication
  SignedIn = 6, // The user must be signed in
  Sensitive = 7, // The user must be recently signed in
}

// ACL requirement for an API
export enum ApiType {
  NoAuth = 0, // No authentication is required
  PasskeyRegistration = 1, // The user is either signing-up, signed-in or upgrading
  SigningUp = 2, // The user is in the middle of signing up
  SignIn = 3, // The user is about to sign in with a username and a credential
  FirstCredential = 4, // The user is about to sign in
  SecondCredential = 5, // The user is about to sign in
  SignedIn = 6, // The user must be signed in
  Sensitive = 7, // The user must be recently signed in
}


export class SessionService {
  constructor(private session: Session) { }

  /**
   * Sets the challenge value for the session.
   * If the challenge is not provided, a random challenge value is generated.
   *
   * @param challenge - The challenge value to set (optional)
   * @returns The challenge value that was set
   */
  setChallenge(challenge?: string): string {
    challenge ??= generateRandomString();
    console.log('set challenge:', challenge);
    this.session.challenge = challenge;
    return challenge;
  }

  /**
   * Retrieves the challenge value from the session.
   *
   * @returns The challenge value stored in the session, or undefined if not found
   */
  getChallenge(): string | undefined {
    console.log('get challenge:', this.session.challenge);
    return this.session.challenge;
  }

  /**
   * Deletes the challenge value from the session.
   */
  deleteChallenge(): void {
    console.log('delete challenge:', this.session.challenge);
    delete this.session.challenge;
  }

  /**
   * Sets the username in the session during the sign-up process.
   *
   * @param user - The sign-up user object.
   */
  setSigningUp(user: SignUpUser): void {
    this.session.signup_username = user.username; // TODO: deprecate
    this.session.signup_user = user;
  }

  /**
   * Retrieve signing up user information.
   *
   * @returns `signup_user` object.
   */
  getSigningUp(): SignUpUser | undefined {
    return this.session.signup_user;
  }

  /**
   * Resets the sign-up state by deleting the `signup_username` from the session.
   */
  resetSigningUp(): void {
    delete this.session.signup_username;
    delete this.session.signup_user;
  }

  /**
   * Sets the username in the session during the sign-in process.
   *
   * @param username - The username to set.
   * @throws Error if `username` is invalid.
   */
  setSigningIn(username: string): void {
    if (!username) {
      throw new Error('Invalid username.');
    }
    this.session.signin_username = username;
  }

  /**
   * Resets the sign-in state by deleting the `signin_username` from the session.
   */
  resetSigningIn(): void {
    delete this.session.signin_username;
  }

  /**
   * Sets the user as signed in in the session.
   * This function updates the session to reflect that the user has successfully
   * signed in. It clears any pending sign-up or sign-in states, sets the
   * `last_signedin_at` timestamp, and stores the user object.
   *
   * @param user - The user object to store in the session.
   */
  setSignedIn(user: User): void {
    this.deleteChallenge();
    this.resetSigningIn();
    this.resetSigningUp();

    this.session.last_signedin_at = getTime();
    this.session.user = user;
  }

  /**
   * Sets the user as signed out in the session.
   * This function destroys the current session, effectively logging the user out.
   */
  setSignedOut(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.session.destroy((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Remember from where the user has entered the website.
   * @param path The path to remember.
   */
  setEntrancePath(path: string): void {
    this.session.entrance = path;
  }

  /**
   * Recall from where the user has entered the website.
   * @returns The entrance path.
   */
  getEntrancePath(): string {
    return this.session?.entrance || '/';
  }

  /**
   * Determines the user's current sign-in status based on session data.
   *
   * @returns The `UserSignInStatus` enum value representing the user's current
   *   authentication status.
   */
  getSignInStatus(): UserSignInStatus {
    const {
      signup_username,
      signin_username,
      signup_user,
      last_signedin_at,
      user,
    } = this.session;

    console.log(this.session);

    if (!user) {
      // TODO: This path is deprecating
      if (signup_username) {
        // The user is signing up.
        return UserSignInStatus.SigningUp;
      }
      if (signup_user) {
        // The user is signing up.
        return UserSignInStatus.SigningUp;
      }
      if (signin_username) {
        // The user is signing in, but not signed in yet.
        return UserSignInStatus.SigningIn;
      }
      // The user is signed out.
      return UserSignInStatus.SignedOut;
    }

    if (
      !last_signedin_at ||
      last_signedin_at < getTime(-config.short_session_duration)
    ) {
      // The user is signed in, but exceeds the short session duration (within the long session duration).
      return UserSignInStatus.SignedIn;
    }
    // The user is signed in, and within the short session duration.
    return UserSignInStatus.RecentlySignedIn;
  }
}

/**
 * Initializes and configures the Express session middleware.
 *
 * This function sets up session management for the application using the
 * `express-session` library. It configures sessions to be stored in
 * Firestore via `@google-cloud/connect-firestore`.
 *
 * Key configurations include:
 * - Session secret for signing the session ID cookie.
 * - Cookie name, path, security (HTTPS only in non-localhost environments),
 *   and maximum age.
 * - Firestore as the session store.
 * - `resave` is set to `true`, forcing the session to be saved back to the
 *   session store, even if the session was never modified during the request.
 * - `saveUninitialized` is set to `false`, preventing empty sessions from
 *   being saved.
 * - `proxy` is set to `true`, which is important if the application is behind
 *   a reverse proxy (like a load balancer) to correctly set secure cookies.
 *
 * @returns {RequestHandler} The configured Express session middleware.
 */
export function initializeSession() {
  return session({
    secret: config.secret,
    resave: true,
    saveUninitialized: false,
    proxy: true,
    name: config.is_localhost ? config.session_cookie_name : `__Secure-${config.session_cookie_name}`,
    store: new CustomFirestoreStore({
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

/**
 * Determines the user's current sign-in status based on session data.
 *
 * This function inspects the `req.session` object for properties like
 * `signup_username`, `signin_username`, `last_signedin_at`, and `user`
 * to ascertain the user's state in the authentication lifecycle.
 *
 * It also populates `res.locals.username` and `res.locals.user` if the
 * user is signing up, signing in, or signed in.
 *
 * @param req The Express Request object, containing session data.
 * @param res The Express Response object, used to store user information in locals.
 * @returns The `UserSignInStatus` enum value representing the user's current
 *   authentication status.
 */
export function getSignInStatus(req: Request, res: Response): UserSignInStatus {
  const sessionService = new SessionService(req.session);
  const status = sessionService.getSignInStatus();

  if (status === UserSignInStatus.SigningUp) {
    const signup_username = req.session.signup_username;
    const signup_user = sessionService.getSigningUp();
    if (signup_username) {
      res.locals.username = signup_username;
    } else if (signup_user) {
      res.locals.username = signup_user.username;
    }
  } else if (status === UserSignInStatus.SigningIn) {
    res.locals.username = req.session.signin_username;
  } else if (status === UserSignInStatus.SignedIn || status === UserSignInStatus.RecentlySignedIn) {
    res.locals.user = req.session.user;
    res.locals.username = res.locals.user.username;
  }

  return status;
}

export function pageAclCheck(pageType: PageType): RequestHandlerParams {
  return (req: Request, res: Response, next: NextFunction): void | any => {
    if (config.enabled_pages && !config.enabled_pages.includes(req.baseUrl + req.path)) {
      return res.status(404).send('Not Found');
    }

    const { signin_status } = res.locals;

    const sessionService = new SessionService(req.session);
    if (pageType === PageType.SignUp) {
      sessionService.resetSigningUp();
      if (signin_status >= UserSignInStatus.SignedIn) {
        // If the user is signed in, redirect to `/home`.
        return res.redirect(307, '/home');
      }
    } else if (pageType === PageType.SigningUp) {
      if (signin_status >= UserSignInStatus.SignedIn) {
        // If the user is signed in, redirect to `/home`.
        return res.redirect(307, '/home');
      }
      if (signin_status < UserSignInStatus.SigningUp) {
        // If the user has not started signing in, redirect to the original entrance.
        return res.redirect(307, '/signup-form');
      }
    } else if (pageType === PageType.SignIn) {
      sessionService.resetSigningIn();
      if (signin_status >= UserSignInStatus.SignedIn) {
        const queryParams = req.query;
        const search = new URLSearchParams(
          queryParams as Record<string, string>
        );
        // If the user is already signed in...
        const entrance = sessionService.getEntrancePath();
        const url = new URL(config.origin);
        if (entrance === '/signin-form') {
          url.pathname = '/password-reauth';
        } else {
          url.pathname = '/passkey-reauth';
        }
        url.search = search.toString();
        return res.redirect(307, url.pathname + url.search);
      }
      sessionService.setEntrancePath(req.path);
    } else if (pageType === PageType.FirstCredential) {
      if (signin_status < UserSignInStatus.SigningIn) {
        // If the user is not signing in, redirect to the original entrance.
        return res.redirect(307, sessionService.getEntrancePath());
      } else if (signin_status >= UserSignInStatus.SignedIn) {
        // If the user is recently signed in, redirect to `/home`.
        return res.redirect(307, '/home');
      }
    } else if (pageType === PageType.Reauth) {
      if (signin_status < UserSignInStatus.SigningIn) {
        // If the user is not signing in, redirect to the original entrance.
        return res.redirect(307, sessionService.getEntrancePath());
      }
      if (signin_status >= UserSignInStatus.RecentlySignedIn) {
        // If the user is recently signed in, redirect to `/home`.
        return res.redirect(307, '/home');
      }
    } else if (pageType === PageType.SignedIn) {
      if (signin_status < UserSignInStatus.SignedIn) {
        // If the user has not signed in yet, redirect to the original entrance.
        return res.redirect(307, sessionService.getEntrancePath());
      }
    } else if (pageType === PageType.Sensitive) {
      if (signin_status < UserSignInStatus.RecentlySignedIn) {
        // Construct the redirect path as `r`
        const url = new URL(sessionService.getEntrancePath(), config.origin);
        const search = new URLSearchParams({ r: req.originalUrl });
        url.search = search.toString();
        console.log(url.toString());

        // If the user has not signed in yet, redirect to the original entrance.
        return res.redirect(307, url.pathname + url.search);
      }
    }
    return next();
  };
}

/**
 * Middleware factory for checking API access control based on user sign-in status.
 * It verifies if the user's current session status meets the required `ApiType`.
 * Depending on the `apiType` and the user's status, it might:
 * - Reject the request with a 400 or 401 status code and JSON error message.
 * - Add `username` and/or `user` object to `res.locals` for downstream middleware.
 * - Allow the request to proceed by calling `next()`.
 *
 * @param apiType The required access level (`ApiType`) for the API endpoint.
 * @returns An Express request handler function.
 */
export function apiAclCheck(apiType: ApiType): RequestHandlerParams {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    const { signin_status } = res.locals;

    // The user is signing up: `/auth/new-username-password` or `/auth/new-user`
    // if (apiType === ApiType.NoAuth) {
    // if (signin_status !== UserSignInStatus.SignedOut) {
    // If the user is already signed in, signing in or signing up, this is
    // an invalid access
    // return res.status(400).json({error: 'The user is already signed in.'});
    // }

    // The user is entering a credential for signing up: `/auth/username-password`
    if (apiType === ApiType.SigningUp) {
      if (signin_status !== UserSignInStatus.SigningUp) {
        // Unless the user is signing up, this is an invalid access
        return res.status(400).json({ error: 'The user is already signed in.' });
      }
      // The user is authenticating or reauthenticating
    } else if (apiType === ApiType.SignIn) {
      if (signin_status !== UserSignInStatus.SignedOut) {
        return res.status(400).json({ error: 'Invalid request.' });
      }
      // The user is signing in and submitting a credential.
    } else if (apiType === ApiType.FirstCredential) {
      if (
        signin_status !== UserSignInStatus.SigningIn &&
        signin_status !== UserSignInStatus.SignedIn
      ) {
        return res.status(400).json({ error: 'The user is not signing in.' });
      }
      // The user must be signed in.
    } else if (apiType === ApiType.SignedIn) {
      if (signin_status < UserSignInStatus.SignedIn) {
        // If the user is not signed in, return an error.
        return res.status(401).json({ error: 'The user is not signed in.' });
      }
      // The user must be recently signed in.
    } else if (apiType === ApiType.Sensitive) {
      if (signin_status < UserSignInStatus.SignedIn) {
        // If the user is not signed in, return an error.
        return res.status(401).json({ error: 'The user is not signed in.' });
      }
      if (signin_status < UserSignInStatus.RecentlySignedIn) {
        // If the user has not authenticated recently, request a reauth.
        return res.status(401).json({ error: 'Insufficient privilege.' });
      }
      // The user is about to register a new passkey upon sign-up or .
    } else if (apiType === ApiType.PasskeyRegistration) {
      if (signin_status < UserSignInStatus.SigningUp) {
        res
          .status(400)
          .json({ error: 'Invalid request. User is not signing up.' });
      }
    }
    return next();
  };
}

/**
 * Sets the user as signed in in the session.
 * This function updates the session to reflect that the user has successfully
 * signed in. It clears any pending sign-up or sign-in states, sets the
 * `last_signedin_at` timestamp, stores the user object, and sets the
 * 'Set-Login' header for the Login Status API.
 *
 * @param user - The user object to store in the session.
 * @param req - The request object.
 * @param res - The response object.
 */
export function setSignedIn(user: User, req: Request, res: Response): void {
  new SessionService(req.session).setSignedIn(user);
  // Set a login status using the Login Status API
  res.set('Set-Login', 'logged-in');
  return;
}

/**
 * Sets the user as signed out in the session.
 * This function destroys the current session, effectively logging the user out.
 * It also sets the 'Set-Login' header for the Login Status API to indicate
 * that the user is logged out.
 *
 * @param req - The request object.
 * @param res - The response object.
 */
export function setSignedOut(req: Request, res: Response) {
  // Destroy the session
  new SessionService(req.session).setSignedOut();

  // Set a login status using the Login Status API
  res.set('Set-Login', 'logged-out');
  return;
}
