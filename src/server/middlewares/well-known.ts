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
import helmet from 'helmet';
const router = express.Router();

router.use(
  helmet({
    crossOriginResourcePolicy: {policy: 'cross-origin'},
  })
);

/**
 * Android Asset Links.
 * @swagger
 * /.well-known/assetlinks.json:
 *   get:
 *     summary: Asset Links
 *     description: Returns the Digital Asset Links JSON for verifying native app associations.
 *     tags: [Well-Known]
 *     responses:
 *       200:
 *         description: Asset links JSON
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get('/assetlinks.json', (req: Request, res: Response): void => {
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
  res.json(assetlinks);
});

/**
 * Web Identity (FedCM).
 * @swagger
 * /.well-known/web-identity:
 *   get:
 *     summary: Web Identity
 *     description: Returns the URL of the FedCM configuration file.
 *     tags: [Well-Known]
 *     responses:
 *       200:
 *         description: Web identity configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 provider_urls:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/web-identity', (req: Request, res: Response): void => {
  const url = new URL(config.origin);
  url.pathname = '/fedcm/config.json';
  const web_endpoint = url.toString();
  res.json({
    provider_urls: [web_endpoint],
  });
});

/**
 * Passkey Endpoints.
 * @swagger
 * /.well-known/passkey-endpoints:
 *   get:
 *     summary: Passkey Endpoints
 *     description: Returns URLs for enrolling and managing passkeys.
 *     tags: [Well-Known]
 *     responses:
 *       200:
 *         description: Passkey endpoints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enroll:
 *                   type: string
 *                 manage:
 *                   type: string
 */
router.get('/passkey-endpoints', (req: Request, res: Response): void => {
  const url = new URL(config.origin);
  url.pathname = '/settings/passkeys';
  const web_endpoint = url.toString();
  res.json({ enroll: web_endpoint, manage: web_endpoint });
});

/**
 * Change Password URL.
 * @swagger
 * /.well-known/change-password:
 *   get:
 *     summary: Change Password
 *     description: Redirects to the change password page.
 *     tags: [Well-Known]
 *     responses:
 *       302:
 *         description: Redirects to /settings/password-change
 */
router.get('/change-password', (req: Request, res: Response): void => {
  res.redirect(302, '/settings/password-change');
});

export {router as wellKnown};
