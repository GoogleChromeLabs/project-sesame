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

/**
 * @file The main Express application file for Project Sesame.
 * @module app
 */

import express, {Request, Response} from 'express';
import {create} from 'express-handlebars';
import useragent from 'express-useragent';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import {config} from '~project-sesame/server/config.ts';
import {
  PageType,
  UserSignInStatus,
  getSignInStatus,
  initializeSession,
  pageAclCheck,
  setChallenge,
  setEntrancePath,
  getEntrancePath,
  setSignedOut,
} from '~project-sesame/server/middlewares/session.ts';
import {admin} from '~project-sesame/server/middlewares/admin.ts';
import {auth} from '~project-sesame/server/middlewares/auth.ts';
import {fedcm} from '~project-sesame/server/middlewares/fedcm.ts';
import {federation} from '~project-sesame/server/middlewares/federation.ts';
import {settings} from '~project-sesame/server/middlewares/settings.ts';
import {webauthn} from '~project-sesame/server/middlewares/webauthn.ts';
import {wellKnown} from '~project-sesame/server/middlewares/well-known.ts';

const app = express();

/**
 * Authentication often needs to add server-side data to the rendered HTML. In order
 * to achieve this, the HTML output from the frontend tooling is used as a base template
 * for SSR templating.

 * @param app The express.js app instance
 */
function configureTemplateEngine(app: express.Application) {
  const hbs = create({
    helpers: {},
    extname: 'html',
    defaultLayout: 'index',
    layoutsDir: path.join(config.views_root_file_path, 'layouts'),
    partialsDir: path.join(config.views_root_file_path, 'partials'),
  });
  app.engine('html', hbs.engine);
  app.set('view engine', 'html');
  app.set('views', path.join(config.views_root_file_path));
}

configureTemplateEngine(app);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'data:', ...config.csp.connect_src],
        scriptSrc: [
          "'self'",
          "'inline-speculation-rules'",
          ...config.csp.script_src,
        ],
        imgSrc: ["'self'", 'data:', ...config.csp.img_src],
        fontSrc: ["'self'", ...config.csp.font_src],
        frameSrc: ["'self'", ...config.csp.frame_src],
        styleSrc: ["'self'", "'unsafe-inline'", ...config.csp.style_src],
        styleSrcElem: ["'self'", ...config.csp.style_src_elem],
      },
      // CSP is report-only if the app is running in debug mode.
      reportOnly: config.debug,
    },
    crossOriginOpenerPolicy: {
      policy: 'same-origin-allow-popups',
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(useragent.express());

app.use(initializeSession());
app.use(cookieParser());

/**
 * Middleware to set default local variables for view templates.
 * This middleware runs for every request and populates `res.locals` with
 * information like the user's sign-in status, helper functions for templates,
 * and the name of the current page for script loading.
 */
app.use((req: Request, res: Response, next) => {
  const width = req.headers['sec-ch-viewport-width'];
  if (typeof width === 'string') {
    res.locals.open_drawer = parseInt(width) > 768;
  }
  res.setHeader('Accept-CH', 'Sec-CH-Viewport-Width');

  res.locals.signin_status = getSignInStatus(req, res);

  res.locals.helpers = {
    isSignedIn: () => res.locals.signin_status >= UserSignInStatus.SignedIn,
  };

  // Use the path to identify the JavaScript file. Append `index` for paths that end with a `/`.
  res.locals.pagename = /\/$/.test(req.path) ? `${req.path}index` : req.path;
  res.locals.layout = res.locals.pagename.slice(1);

  return next();
});

app.locals.origin_trials = config.origin_trials;
app.locals.repository_url = config.repository_url;
app.locals.debug = config.debug;

/**
 * Serves the main landing page of the application.
 * @route GET /
 */
app.get('/', pageAclCheck(PageType.NoAuth), (req: Request, res: Response) => {
  return res.render('index.html', {
    title: 'Welcome!',
  });
});

/**
 * Serves the user registration page with a username/password form.
 * @route GET /signup-form
 */
app.get(
  '/signup-form',
  pageAclCheck(PageType.SignUp),
  (req: Request, res: Response) => {
    // Manually set the entrance path as this is a sign-up page
    setEntrancePath(req, res, '/signin-form');

    return res.render('signup-form.html', {
      title: 'Sign-Up Form',
    });
  }
);

/**
 * Serves the user sign-in page with a username/password form.
 * @route GET /signin-form
 */
app.get(
  '/signin-form',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('signin-form.html', {
      title: 'Sign-In Form',
    });
  }
);

/**
 * Serves the page for creating a new password during the sign-up flow.
 * Requires the user to be in the 'signing up' state.
 * @route GET /new-password
 */
app.get(
  '/new-password',
  pageAclCheck(PageType.SigningUp),
  (req: Request, res: Response) => {
    res.render('new-password.html', {
      title: 'Password',
    });
  }
);

/**
 * Serves the password entry page during a sign-in flow.
 * Requires the user to have already provided a username.
 * @route GET /password
 */
app.get(
  '/password',
  pageAclCheck(PageType.FirstCredential),
  (req: Request, res: Response) => {
    res.render('password.html', {
      title: 'Password verification',
    });
  }
);

/**
 * Serves the password re-authentication page for sensitive operations.
 * Requires the user to be signed in but not recently authenticated.
 * @route GET /password-reauth
 */
app.get(
  '/password-reauth',
  pageAclCheck(PageType.Reauth),
  (req: Request, res: Response) => {
    res.render('password-reauth.html', {
      title: 'Password reauthentication',
    });
  }
);

/**
 * Serves a page demonstrating the FedCM delegation flow for sign-up.
 * This allows a third-party identity provider to delegate credential creation.
 * @route GET /fedcm-delegate
 */
app.get(
  '/fedcm-delegate',
  pageAclCheck(PageType.SignUp),
  (req: Request, res: Response) => {
    // Manually set the entrance path as this is a sign-up page
    setEntrancePath(req, res, '/passkey-form-autofill');

    return res.render('fedcm-delegate.html', {
      title: 'FedCM delegation flow',
    });
  }
);

/**
 * Serves a page demonstrating an identifier-first sign-in flow using FedCM
 * with form autofill.
 * @route GET /fedcm-form-autofill
 */
app.get(
  '/fedcm-form-autofill',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('fedcm-form-autofill.html', {
      title: 'Identifier-first form',
    });
  }
);

/**
 * Serves a page demonstrating passkey sign-in via form autofill.
 * This is also known as conditional UI.
 * @route GET /passkey-form-autofill
 */
app.get(
  '/passkey-form-autofill',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('passkey-form-autofill.html', {
      title: 'Passkey form autofill',
    });
  }
);

/**
 * Serves a page demonstrating a "one-button" passkey sign-in flow.
 * This uses a dedicated button to trigger the WebAuthn API.
 * @route GET /passkey-one-button
 */
app.get(
  '/passkey-one-button',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('passkey-one-button.html', {
      title: 'Passkey one button',
    });
  }
);

/**
 * Serves the passkey re-authentication page for sensitive operations.
 * Requires the user to be signed in but not recently authenticated.
 * @route GET /passkey-reauth
 */
app.get(
  '/passkey-reauth',
  pageAclCheck(PageType.Reauth),
  (req: Request, res: Response) => {
    res.render('passkey-reauth.html', {
      title: 'Passkey reauthentication',
    });
  }
);

/**
 * Serves the passkey sign-up page.
 * @route GET /passkey-signup
 */
app.get(
  '/passkey-signup',
  pageAclCheck(PageType.SignUp),
  (req: Request, res: Response) => {
    // Manually set the entrance path as this is a sign-up page
    setEntrancePath(req, res, '/passkey-form-autofill');

    return res.render('passkey-signup.html', {
      title: 'Passkey sign-up',
    });
  }
);

/**
 * Serves a page demonstrating FedCM in "active" or "button" mode,
 * where the user explicitly clicks a button to initiate sign-in.
 * @route GET /fedcm-active-mode
 */
app.get(
  '/fedcm-active-mode',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('fedcm-active-mode.html', {
      title: 'FedCM active mode',
    });
  }
);

/**
 * Serves a page demonstrating FedCM in "passive" or "widget" mode,
 * which attempts to sign the user in automatically on page load.
 * @route GET /fedcm-passive-mode
 */
app.get(
  '/fedcm-passive-mode',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('fedcm-passive-mode.html', {
      title: 'FedCM passive mode',
    });
  }
);

/**
 * Serves a page demonstrating the unified Credential Manager API (`navigator.credentials.get()`)
 * that can handle both passwords and passkeys.
 * @route GET /password-passkey
 */
app.get(
  '/password-passkey',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('password-passkey.html', {
      title: 'Credential Manager for the Web',
    });
  }
);

/**
 * Serves a page demonstrating the legacy Credential Management API.
 * @route GET /legacy-credman
 */
app.get(
  '/legacy-credman',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('legacy-credman.html', {
      title: 'Legacy Credential Management',
    });
  }
);

/**
 * Serves the user's home/dashboard page after they have signed in.
 * @route GET /home
 */
app.get(
  '/home',
  pageAclCheck(PageType.SignedIn),
  (req: Request, res: Response) => {
    return res.render('home.html', {
      title: 'home',
    });
  }
);

/**
 * Handles user sign-out. It destroys the session and redirects the user
 * to their original entry point.
 * @route GET /signout
 */
app.get(
  '/signout',
  pageAclCheck(PageType.SignedIn),
  (req: Request, res: Response) => {
    const entrancePath = getEntrancePath(req, res);

    setSignedOut(req, res);

    return res.redirect(307, entrancePath);
  }
);

app.use('/admin', admin);
app.use('/auth', auth);
app.use('/fedcm', fedcm);
app.use('/federation', federation);
app.use('/settings', settings);
app.use('/webauthn', webauthn);
app.use('/.well-known', wellKnown);

app.use(
  '/static',
  express.static(path.join(config.dist_root_file_path, 'client/static'))
);
app.use(
  helmet({
    crossOriginResourcePolicy: {policy: 'cross-origin'},
  }),
  express.static(path.join(config.dist_root_file_path, 'shared/public'))
);

// After successfully registering all routes, add a health check endpoint.
// Do it last, as previous routes may throw errors during start-up.
app.get('/__health-check', (req: Request, res: Response) => {
  return res.send('OK');
});

app.listen(config.port, () => {
  console.log(`Server listening at ${config.origin}`);
});
