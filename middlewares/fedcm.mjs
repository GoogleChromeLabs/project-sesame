/*
 * @license
 * Copyright 2024 Google Inc. All rights reserved.
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
const router = express.Router();
import { Users } from '../libs/db.mjs';
import * as jwt from 'jsonwebtoken';
import { csrfCheck, sessionCheck } from '../libs/common.mjs';

router.use(express.json());

router.get('/config.json', (req, res) => {
  return res.json({
    "accounts_endpoint": "/fedcm/accounts",
    "client_metadata_endpoint": "/fedcm/metadata",
    "id_assertion_endpoint": "/fedcm/idtokens",
    "disconnect_endpoint": "/fedcm/disconnect",
    "login_url": "/identifier-first-form",
    "branding": {
      "background_color": "#6200ee",
      "color": "#ffffff",
      "icons": [{
        "url": "https://cdn.glitch.global/3e0c8298-f17f-4c5b-89ea-f93a6f29cb1e/icon.png?v=1654655899873",
        "size": 256,
      }]
    }
  });
});

router.get('/accounts', csrfCheck, sessionCheck, (req, res) => {
  const user = res.locals.user;

  if (user.status === 'session_expired') {
    return res.status(401).json({ error: 'not signed in');
  }

  return res.json({
    accounts: [{
      id: user.id,
      name: user.displayName,
      email: user.username,
      picture: user.picture,
      approved_clients: []
    }]
  });
});

router.get('/metadata', (req, res) => {
  return res.json({
    privacy_policy_url: `${process.env.ORIGIN}/privacy_policy`,
    terms_of_service_url:`${process.env.ORIGIN}/terms_of_service` 
  });
});

router.post('/idtokens', csrfCheck, sessionCheck, (req, res) => {
  const { client_id, nonce, account_id, consent_acquired, disclosure_text_shown } = req.body;
  let user = res.locals.user;

  // TODO: Revisit the hardcoded RP client ID handling
  
  // If the user did not consent or the account does not match who is currently signed in, return error.
  if (client_id !== RP_CLIENT_ID ||
      account_id !== user.id ||
      !isValidOrigin(new URL(req.headers.origin).toString())) {
    console.error('Invalid request.', req.body);
    return res.status(400).json({ error: 'Invalid request.' });
  }

  if (consent_acquired === 'true' ||
      disclosure_text_shown ==='true' ||
      !user.approved_clients.includes(RP_CLIENT_ID)) {
    console.log('The user is registering to the RP.');
    user.approved_clients.push(RP_CLIENT_ID);
    Users.update(user);
  } else {
    console.log('The user is signing in to the RP.');
  }

  if (user.status === '') {
    const token = jwt.sign({
      iss: process.env.ORIGIN,
      sub: user.id,
      aud: client_id,
      nonce,
      exp: new Date().getTime()+IDTOKEN_LIFETIME,
      iat: new Date().getTime(),
      name: `${user.displayName}`,
      email: user.username,
      picture: user.picture
    }, process.env.SECRET);

    return res.json({ token });

  } else {
    let error_code = 401;
    switch (user.status) {
      case 'server_error':
        error_code = 500;
        break;
      case 'temporarily_unavailable':
        error_code = 503;
        break;
      default:
        error_code = 401;
    }
    return res.status(error_code).json({
      error: {
        code: user.status,
        url: `${process.env.ORIGIN}/error.html&type=${user.status}`
      }
    });
  }
});

router.post('/disconnect', csrfCheck, sessionCheck, (req, res) => {
  const { account_hint, client_id } = req.body;

  const user = res.locals.user;

  // TODO: Use PPID instead
  if (account_hint !== user.id) {
    console.error("Account hint doesn't match.");
    return res.status(401).json({ error: "Account hint doesn't match." });
  }

  if (!user.approved_clients.has(client_id)) {
    console.error('The client is not connected.');
    return res.status(400).json({ error: 'The client is not connected.' });
  }

  // Remove the client ID from the `approved_clients` list.
  user.approved_clients = user.approved_clients.filter(_client_id => _client_id !== client_id);
  Users.update(user);
  return res.json({ account_id: user.id });
});

module.exports = router;
