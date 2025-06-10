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
import express, {Request, Response} from 'express';
import {config} from '~project-sesame/server/config.ts';
const router = express.Router();

router.get('/assetlinks.json', (req: Request, res: Response) => {
  const assetlinks = [];
  for (const domain of config.associated_domains) {
    if (domain.sha256_cert_fingerprints) {
      assetlinks.push({
        relation: [
          'delegate_permission/common.handle_all_urls',
          'delegate_permission/common.get_login_creds',
        ],
        target: {
          namespace: 'android_app',
          package_name: domain.package_name,
          sha256_cert_fingerprints: [domain.sha256_cert_fingerprints],
        },
      });
    } else {
      assetlinks.push({
        relation: [
          'delegate_permission/common.handle_all_urls',
          'delegate_permission/common.get_login_creds',
        ],
        target: {
          namespace: 'web',
          site: domain.site,
        },
      });
    }
  }
  return res.json(assetlinks);
});

router.get('/webidentity', (req: Request, res: Response) => {
  const url = new URL(config.origin);
  url.pathname = '/fedcm/config.json';
  const web_endpoint = url.toString();
  return res.json({
    provider_urls: [web_endpoint],
  });
});

router.get('/passkey-endpoints', (req: Request, res: Response) => {
  const url = new URL(config.origin);
  url.pathname = '/settings/passkeys';
  const web_endpoint = url.toString();
  return res.json({enroll: web_endpoint, manage: web_endpoint});
});

router.get('/change-password', (req: Request, res: Response) => {
  return res.redirect(302, '/settings/password-change');
});

export {router as wellKnown};
