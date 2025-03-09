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
import {config} from '~project-sesame/server/config.ts';
const router = express.Router();

router.get('/assetlinks.json', (req, res) => {
  const assetlinks = [];
  for (let domain of config.associated_domains) {
    if (domain?.sha256_cert_fingerprints) {
      assetlinks.push({
        relation: ['delegate_permission/common.get_login_creds'],
        target: {
          namespace: 'android_app',
          package_name: domain.package_name,
          sha256_cert_fingerprints: [ domain.sha256_cert_fingerprints ]
        },
      });
    } else {
      assetlinks.push({
        relation: ['delegate_permission/common.get_login_creds'],
        target: {
          namespace: 'web',
          site: config.domain,
        },
      });
    }
  }
  return res.json(assetlinks);
});

router.get('/webidentity', (req, res) => {
  const fedcm_config_url = `${config.origin}/fedcm/config.json`;
  return res.json({
    provider_urls: [fedcm_config_url],
  });
});

router.get('/passkey-endpoints', (req, res) => {
  const web_endpoint = `${config.origin}/home`;
  return res.json({enroll: web_endpoint, manage: web_endpoint});
});

export {router as wellKnown};
