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

import express from 'express';
import {engine, create} from 'express-handlebars';
import useragent from 'express-useragent';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import config from '~project-sesame/server/config.ts';
import {auth} from '~project-sesame/server/middlewares/auth.ts';
import {federation} from '~project-sesame/server/middlewares/federation.ts';
import {
  SignInStatus,
  getEntrancePath,
  initializeSession,
  sessionCheck,
  setChallenge,
  setEntrancePath,
  signOut,
} from '~project-sesame/server/middlewares/session.ts';
import {webauthn} from '~project-sesame/server/middlewares/webauthn.ts';
import {settings} from '~project-sesame/server/middlewares/settings.ts';
import {wellKnown} from '~project-sesame/server/middlewares/well-known.ts';

const app = express();

/**
 * Authentication often needs to add server-side data to the rendered HTML. In order
 * to achieve this, the HTML output from the frontend tooling is used as a base template
 * for SSR templating.

 * @param app The express.js app instance
 */
function configureTemplateEngine(app: express.Application) {
  app.set('view engine', 'html');
  app.engine(
    'html',
    engine({
      extname: 'html',
      defaultLayout: 'index',
      layoutsDir: path.join(config.views_root_file_path, 'layouts'),
      partialsDir: path.join(config.views_root_file_path, 'partials'),
    })
  );
  app.set('views', path.join(config.views_root_file_path));
}

configureTemplateEngine(app);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        connectSrc: ["'self'", 'https://fedcm-idp-demo.glitch.me'],
        scriptSrc: ["'self'", "'inline-speculation-rules'", 'https://fedcm-idp-demo.glitch.me'],
        imgSrc: ["'self'", 'data:', 'https://www.gravatar.com', 'https://gravatar.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      },
      // CSP is report-only if the app is running in debug mode.
      reportOnly: config.debug,
    },
  })
);

app.use(express.json());
app.use(useragent.express());

app.use(initializeSession());
app.use(cookieParser());

app.use((req, res, next) => {
  res.locals.helpers = {
    isSignedIn: () => res.locals.signin_status >= SignInStatus.SignedIn
  };
  return next();
});

app.use((req, res, next) => {
  // Use the path to identify the JavaScript file. Append `index` for paths that end with a `/`.
  res.locals.pagename = /\/$/.test(req.path) ? `${req.path}index` : req.path;

  return next();
});

app.locals.origin_trials = process.env.ORIGIN_TRIALS ? process.env.ORIGIN_TRIALS.split(',') : [];

app.get('/', (req, res) => {
  return res.render('index.html', {
    title: 'Welcome!',
    layout: 'index',
  });
});

app.get('/signup-form', sessionCheck, (req, res) => {
  // Set `/identifier-first-form` as the entrance path.
  setEntrancePath(req, res, '/identifier-first-form');

  if (res.locals.signin_status >= SignInStatus.SignedIn) {
    // If the user is signed in, redirect to `/home`.
    return res.redirect(307, '/home');
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render('signup-form.html', {
    title: 'Sign-Up Form',
    layout: 'signup-form',
  });
});

app.get('/new-password', sessionCheck, (req, res) => {
  if (res.locals.signin_status < SignInStatus.SigningUp) {
    // If the user has not started signing in, redirect to the original entrance.
    return res.redirect(307, getEntrancePath(req, res));
  }
  if (res.locals.signin_status >= SignInStatus.SignedIn) {
    // If the user is signed in, redirect to `/home`.
    return res.redirect(307, '/home');
  }

  res.render('new-password.html', {
    title: 'Password',
    layout: 'new-password',
  });
});

app.get('/signin-form', sessionCheck, (req, res) => {
  setEntrancePath(req, res);

  if (res.locals.signin_status === SignInStatus.SigningIn) {
    // If the user is signing in, redirect to `/password`.
    return res.redirect(307, '/password');
  }
  if (res.locals.signin_status >= SignInStatus.SignedIn) {
    // If the user is signed in, redirect to `/home`.
    return res.redirect(307, '/home');
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render('signin-form.html', {
    title: 'Sign-In Form',
    layout: 'signin-form',
  });
});

app.get('/identifier-first-form', sessionCheck, (req, res) => {
  setEntrancePath(req, res);

  if (res.locals.signin_status === SignInStatus.SigningIn) {
    // If the user is signing in, redirect to `/password`.
    return res.redirect(307, '/password');
  }
  if (res.locals.signin_status >= SignInStatus.SignedIn) {
    // If the user is signed in, redirect to `/home`.
    return res.redirect(307, '/home');
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render('identifier-first-form.html', {
    title: 'Identifier-first form',
    layout: 'identifier-first-form',
  });
});

app.get('/passkey-one-button', sessionCheck, (req, res) => {
  setEntrancePath(req, res);

  if (res.locals.signin_status === SignInStatus.SigningIn) {
    // If the user is signing in, redirect to `/password`.
    return res.redirect(307, '/password');
  }
  if (res.locals.signin_status >= SignInStatus.SignedIn) {
    // If the user is signed in, redirect to `/home`.
    return res.redirect(307, '/home');
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render('passkey-one-button.html', {
    title: 'Passkey one button',
    layout: 'passkey-one-button',
  });
});

app.get('/passkey-reauth', sessionCheck, (req, res) => {
  if (res.locals.signin_status < SignInStatus.SigningIn) {
    // If the user has not started signing in, redirect to the original entrance.
    return res.redirect(307, getEntrancePath(req, res));
  }

  res.render('passkey-reauth.html', {
    title: 'Passkey reauth',
    layout: 'passkey-reauth',
  });
});

app.get('/unified-button', sessionCheck, (req, res) => {
  setEntrancePath(req, res);

  if (res.locals.signin_status === SignInStatus.SigningIn) {
    // If the user is signing in, redirect to `/password`.
    return res.redirect(307, '/password');
  }
  if (res.locals.signin_status >= SignInStatus.SignedIn) {
    // If the user is signed in, redirect to `/home`.
    return res.redirect(307, '/home');
  }
  // Generate a new nonce.
  const nonce = setChallenge(req, res);

  // If the user is not signed in, show `index.html` with id/password form.
  return res.render('unified-button.html', {
    title: 'Unified button',
    layout: 'unified-button',
    nonce,
  });
});

app.get('/fedcm-rp', sessionCheck, (req, res) => {
  setEntrancePath(req, res);

  if (res.locals.signin_status === SignInStatus.SigningIn) {
    // If the user is signing in, redirect to `/password`.
    return res.redirect(307, '/password');
  }
  if (res.locals.signin_status >= SignInStatus.SignedIn) {
    // If the user is signed in, redirect to `/home`.
    return res.redirect(307, '/home');
  }

  // Generate a new nonce.
  const nonce = setChallenge(req, res);

  // If the user is not signed in, show `fedcm-rp.html` with id/password form.
  return res.render('fedcm-rp.html', {
    title: 'FedCM RP',
    layout: 'fedcm-rp',
    nonce,
  });
});

app.get('/password-passkey', sessionCheck, (req, res) => {
  setEntrancePath(req, res);

  if (res.locals.signin_status === SignInStatus.SigningIn) {
    // If the user is signing in, redirect to `/password`.
    return res.redirect(307, '/password');
  }
  if (res.locals.signin_status >= SignInStatus.SignedIn) {
    // If the user is signed in, redirect to `/home`.
    return res.redirect(307, '/home');
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render('password-passkey.html', {
    title: 'Password and passkey unified Credential Manager',
    layout: 'password-passkey',
  });
});

app.get('/password', sessionCheck, (req, res) => {
  if (res.locals.signin_status < SignInStatus.SigningIn) {
    // If the user has not started signing in, redirect to the original entrance.
    return res.redirect(307, getEntrancePath(req, res));
  }
  if (res.locals.signin_status === SignInStatus.RecentlySignedIn) {
    // If the user is signed in, redirect to `/home`.
    return res.redirect(307, '/home');
  }

  res.render('password.html', {
    title: 'Password',
    layout: 'password',
  });
});

app.get('/home', sessionCheck, (req, res) => {
  if (res.locals.signin_status < SignInStatus.SignedIn) {
    // If the user has not signed in yet, redirect to the original entrance.
    return res.redirect(307, getEntrancePath(req, res));
  }
  // `home.html` shows sign-out link
  return res.render('home.html', {
    title: 'home',
    layout: 'home',
  });
});

app.get('/signout', signOut);

app.use('/auth', auth);
app.use('/webauthn', webauthn);
app.use('/federation', federation);
app.use('/settings', settings);
app.use('/.well-known', wellKnown);

app.use(
  '/static',
  express.static(path.join(config.dist_root_file_path, 'client/static'))
);
app.use(express.static(path.join(config.dist_root_file_path, 'shared/public')));

// After successfully registering all routes, add a health check endpoint.
// Do it last, as previous routes may throw errors during start-up.
app.get('/__health-check', (req, res) => {
  return res.send('OK');
});

app.listen(config.port, () => {
  console.log(`Server listening at ${config.origin}`);
});
