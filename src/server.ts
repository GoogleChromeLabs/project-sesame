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

import { __dirname, initialize } from './config.js';
import path from 'path';
import express from 'express';
import session from 'express-session';
import { engine } from 'express-handlebars';
const app = express();
import useragent from 'express-useragent';
import { SessionStore } from './libs/session-store.js';
import { auth } from './middlewares/auth.js';
import { webauthn } from './middlewares/webauthn.js';
import { federation } from './middlewares/federation.js';
import { wellKnown } from './middlewares/well-known.js';

initialize(app);

const views = path.join(__dirname, 'views');
app.set('view engine', 'html');
app.engine('html', engine({
  extname: 'html',
  defaultLayout: 'index',
  layoutsDir: path.join(views, 'layouts'),
  partialsDir: path.join(views, 'partials'),
}));
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(useragent.express());
app.use(express.static(path.join(__dirname, 'static')));
app.use(session({
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
}));

app.use((req, res, next) => {
  process.env.HOSTNAME = req.hostname;
  const protocol = process.env.NODE_ENV === 'localhost' ? 'http' : 'https';
  // TODO: Use `URL` object
  // TODO: Why doesn't this contain a port?
  process.env.ORIGIN = `${protocol}://${req.headers.host}`;
  // Use the path to identify the JavaScript file. Append `index` for paths that end with a `/`.
  res.locals.pagename = /\/$/.test(req.path) ? `${req.path}index` : req.path;
  return next();
});

app.get('/', (req, res) => {
  // Check session
  if (req.session.username) {
    // If username is known, redirect to `/password`.
    return res.redirect(307, '/password');
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render('index.html');
});

app.get('/identifier-first-form', (req, res) => {
  // Check session
  if (req.session.username) {
    // If username is known, redirect to `/password`.
    return res.redirect(307, '/password');
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render('identifier-first-form.html');
});

app.get('/passkey-one-button', (req, res) => {
  // Check session
  if (req.session.username) {
    // If username is known, redirect to `/password`.
    return res.redirect(307, '/password');
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render('passkey-one-button.html');
});

app.get('/password', (req, res) => {
  const username = req.session.username;
  if (!username) {
    return res.redirect(302, '/');
  }
  // Show `reauth.html`.
  // User is supposed to enter a password (which will be ignored)
  // Make XHR POST to `/signin`
  res.render('password.html', {
    username: username,
  });
});

app.get('/fedcm-rp', (req, res) => {
  // Check session
  if (req.session.username) {
    // If username is known, redirect to `/password`.
    return res.redirect(307, '/password');
  }

  const nonce = Math.floor(Math.random()*10e10);

  // TODO: Kill this nonce
  req.session.nonce = nonce;

  // If the user is not signed in, show `fedcm-rp.html` with id/password form.
  return res.render('fedcm-rp.html', { nonce });
});

app.get('/home', (req, res) => {
  if (!req.session.username || req.session['signed-in'] != 'yes') {
    // If user is not signed in, redirect to `/`.
    return res.redirect(307, '/');
  }
  // `home.html` shows sign-out link
  return res.render('home.html', {
    displayName: req.session.username,
  });
});

app.use('/auth', auth);
app.use('/webauthn', webauthn);
app.use('/federation', federation);
app.use('/.well-known', wellKnown);
app.listen(process.env.PORT || 8080)
