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

import { __dirname, configureApp, config } from "./config.js";
import path from "path";
import express from "express";
import { engine } from "express-handlebars";
const app = express();
import useragent from "express-useragent";
import { auth } from "./middlewares/auth.js";
import {
  initializeSession,
  getUsername,
  setChallenge,
  isSignedIn,
} from "./middlewares/session.js";
import { webauthn } from "./middlewares/webauthn.js";
import { federation } from "./middlewares/federation.js";
import { wellKnown } from "./middlewares/well-known.js";

configureApp(app);

const views = path.join(__dirname, "views");
app.set("view engine", "html");
app.engine(
  "html",
  engine({
    extname: "html",
    defaultLayout: "index",
    layoutsDir: path.join(views, "layouts"),
    partialsDir: path.join(views, "partials"),
  })
);
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(useragent.express());
app.use(express.static(path.join(__dirname, "static")));
app.use(initializeSession());

app.use((req, res, next) => {
  process.env.HOSTNAME = req.hostname;
  const protocol = config.is_localhost ? "http" : "https";
  // TODO: Use `URL` object
  // TODO: Why doesn't this contain a port?
  process.env.ORIGIN = `${protocol}://${req.headers.host}`;
  // Use the path to identify the JavaScript file. Append `index` for paths that end with a `/`.
  res.locals.pagename = /\/$/.test(req.path) ? `${req.path}index` : req.path;

  if (config.debug && !/(\.css|\.js|\.map|\.svg|\.json)$/.test(req.path)) {
    console.log(`Accessing: ${res.locals.pagename}`);
    console.log(req.session);
  }
  return next();
});

app.get("/", (req, res) => {
  // Check session
  if (getUsername(req, res)) {
    // If username is known, redirect to `/password`.
    return res.redirect(307, "/password");
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render("index.html");
});

app.get("/identifier-first-form", (req, res) => {
  // Check session
  if (getUsername(req, res)) {
    // If username is known, redirect to `/password`.
    return res.redirect(307, "/password");
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render("identifier-first-form.html");
});

app.get("/passkey-one-button", (req, res) => {
  // Check session
  if (getUsername(req, res)) {
    // If username is known, redirect to `/password`.
    return res.redirect(307, "/password");
  }
  // If the user is not signed in, show `index.html` with id/password form.
  return res.render("passkey-one-button.html");
});

app.get("/password", (req, res) => {
  const username = getUsername(req, res);
  if (!username) {
    return res.redirect(302, "/");
  }
  // Show `reauth.html`.
  // User is supposed to enter a password (which will be ignored)
  // Make XHR POST to `/signin`
  res.render("password.html", {
    username: username,
  });
});

app.get("/fedcm-rp", (req, res) => {
  // Check session
  if (getUsername(req, res)) {
    // If username is known, redirect to `/password`.
    return res.redirect(307, "/password");
  }

  const nonce = setChallenge('', req, res);

  // If the user is not signed in, show `fedcm-rp.html` with id/password form.
  return res.render("fedcm-rp.html", { nonce });
});

app.get("/home", (req, res) => {
  if (!isSignedIn(req, res)) {
    // If user is not signed in, redirect to `/`.
    return res.redirect(307, "/");
  }
  // `home.html` shows sign-out link
  return res.render("home.html", {
    displayName: getUsername(req, res),
  });
});

app.use("/auth", auth);
app.use("/webauthn", webauthn);
app.use("/federation", federation);
app.use("/.well-known", wellKnown);
app.listen(process.env.PORT || 8080);
