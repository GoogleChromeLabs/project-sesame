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
import { csrfCheck, sessionCheck } from '../libs/common.mjs';

router.use(express.json());

router.get('/config.json', (req, res) => {
  return res.json({
    "accounts_endpoint": "/fedcm/accounts",
    "client_metadata_endpoint": "/fedcm/metadata",
    "id_assertion_endpoint": "/fedcm/idtokens",
    "revocation_endpoint": "/fedcm/revoke",
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

router.get('/accounts', (req, res) => {
});

router.get('/metadata', (req, res) => {
});

router.post('/idtokens', (req, res) => {
});

router.post('/disconnect', (req, res) => {
});

module.exports = router;
