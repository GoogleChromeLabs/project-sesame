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

import {Base64URLString} from '@simplewebauthn/server';
import {Router, Request, Response} from 'express';
import jwt from 'jsonwebtoken';

import {config} from '../config.ts';
import {compareUrls} from '../libs/helpers.ts';
import {IdentityProviders} from '../libs/identity-providers.ts';
import {RelyingParties} from '../libs/relying-parties.ts';
import {Users} from '../libs/users.ts';
import cors from 'cors';
import helmet from 'helmet';
import {fedcmCheck, getTime} from '../middlewares/common.ts';
import {ApiType, apiAclCheck} from '../libs/session.ts';

const router = Router();

const idp_info = await IdentityProviders.findByOrigin(config.origin);

router.use(
  helmet({
    crossOriginResourcePolicy: {policy: 'cross-origin'},
  })
);

router.use(
  cors({
    origin: true,
    credentials: true,
  })
);

/**
 * Get FedCM configuration.
 * @swagger
 * /fedcm/config.json:
 *   get:
 *     summary: FedCM Configuration
 *     description: Returns the FedCM configuration file required for the IDP.
 *     tags: [FedCM]
 *     responses:
 *       200:
 *         description: Configuration object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accounts_endpoint:
 *                   type: string
 *                 client_metadata_endpoint:
 *                   type: string
 *                 id_assertion_endpoint:
 *                   type: string
 *                 disconnect_endpoint:
 *                   type: string
 *                 login_url:
 *                   type: string
 *                 branding:
 *                   type: object
 */
router.get(
  '/config.json',
  apiAclCheck(ApiType.NoAuth),
  (req: Request, res: Response) => {
    res.json({
      accounts_endpoint: '/fedcm/accounts',
      client_metadata_endpoint: '/fedcm/metadata',
      id_assertion_endpoint: '/fedcm/idtokens',
      disconnect_endpoint: '/fedcm/disconnect',
      login_url: '/passkey-form-autofill',
      branding: {
        background_color: '#6200ee',
        color: '#ffffff',
        icons: [
          {
            url: `${config.origin}/images/idp-logo-512.png`,
            size: 512,
          },
        ],
      },
    });
  }
);

/**
 * Get FedCM accounts.
 * @swagger
 * /fedcm/accounts:
 *   get:
 *     summary: List Accounts
 *     description: Returns a list of accounts for FedCM.
 *     tags: [FedCM]
 *     responses:
 *       200:
 *         description: Accounts list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       picture:
 *                         type: string
 * */
router.get(
  '/accounts',
  fedcmCheck,
  apiAclCheck(ApiType.SignedIn),
  (req: Request, res: Response): void => {
    const {user} = res.locals;

    //TODO: Read the database and determine whether the user has registered with
    //the RP before.

    // Only one signed-in account at a time is supported on Project Sesame.
    res.json({
      accounts: [
        {
          id: user.id,
          name: user.displayName,
          email: user.username,
          picture: user.picture,
          approved_clients: user.approved_clients ?? [],
        },
      ],
    });
  }
);

/**
 * Get FedCM client metadata.
 * @swagger
 * /fedcm/metadata:
 *   get:
 *     summary: Client Metadata
 *     description: Returns metadata URLs for the IDP, such as privacy policy and terms of service.
 *     tags: [FedCM]
 *     responses:
 *       200:
 *         description: Metadata URLs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 privacy_policy_url:
 *                   type: string
 *                 terms_of_service_url:
 *                   type: string
 */
router.get(
  '/metadata',
  apiAclCheck(ApiType.NoAuth),
  (req: Request, res: Response): void => {
    res.json({
      privacy_policy_url: `${config.origin}/privacy_policy`,
      terms_of_service_url: `${config.origin}/terms_of_service`,
    });
  }
);

/**
 * Issue an identity assertion.
 * @swagger
 * /fedcm/idtokens:
 *   post:
 *     summary: Issue ID Token
 *     description: Verifies the request and issues an ID token for FedCM.
 *     tags: [FedCM]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_id
 *               - nonce
 *               - account_id
 *             properties:
 *               client_id:
 *                 type: string
 *               nonce:
 *                 type: string
 *               account_id:
 *                 type: string
 *               consent_acquired:
 *                 type: string
 *               disclosure_text_shown:
 *                 type: string
 *     responses:
 *       200:
 *         description: ID Token issued
 *       400:
 *         description: Bad request or validation failure
 */
router.post(
  '/idtokens',
  fedcmCheck,
  apiAclCheck(ApiType.SignedIn),
  async (req: Request, res: Response): Promise<void> => {
    const {
      client_id,
      nonce,
      account_id,
      consent_acquired,
      disclosure_text_shown,
    } = req.body;
    const {user} = res.locals;

    if (!idp_info) {
      console.log("I am not a registrable IdP: ", config.origin)
      res.status(400).json({ error: 'I am not a registrable IdP: ' });
      return;
    }
    const rp = await RelyingParties.findByClientID(client_id);

    // Error when: the RP is not registered.
    if (!rp) {
      const message = `RP not registered. Client ID: ${client_id}`;
      console.error(message);
      res.status(400).json({ error: message });
      return;
    }
    // Error when: The RP URL matches the requesting origin.
    if (!compareUrls(rp.origin, req.headers.origin)) {
      const message = `RP origin doesn't match: ${rp.origin}`;
      console.error(message);
      res.status(400).json({ error: message });
      return;
    }
    // Error when: the account does not match who is currently signed in.
    if (account_id !== user.id) {
      const message = `Account ID doesn't match: ${account_id}`;
      console.error(message);
      res.status(400).json({ error: message });
      return;
    }

    // TODO: Should it reject if consent is not acquired?
    if (
      (consent_acquired === 'true' || disclosure_text_shown === 'true') &&
      (!user.approved_clients || !user.approved_clients.includes(rp.client_id))
    ) {
      console.log('The user is registering to the RP.');
      // Add the current RP as an approved client to sign in with this account
      if (!user.approved_clients) {
        user.approved_clients = [];
      }
      if (!user.approved_clients.includes(rp.client_id)) {
        user.approved_clients.push(rp.client_id);
        await Users.update(user);
      }
    } else {
      console.log('The user is signing in to the RP.');
    }

    // if (user.status === '') {
    const token = jwt.sign(
      {
        iss: config.origin,
        sub: user.id,
        aud: client_id,
        nonce,
        exp: getTime(config.id_token_lifetime),
        iat: getTime(),
        name: `${user.displayName}`,
        email: user.username,
        picture: user.picture,
      },
      idp_info.secret
    );

    res.json({ token });
    // } else {
    //   let error_code = 401;
    //   switch (user.status) {
    //     case 'server_error':
    //       error_code = 500;
    //       break;
    //     case 'temporarily_unavailable':
    //       error_code = 503;
    //       break;
    //     default:
    //       error_code = 401;
    //   }
    //   return res.status(error_code).json({
    //     error: {
    //       code: user.status,
    //       url: `${config.origin}/error.html&type=${user.status}`,
    //     },
    //   });
    // }
  }
);

/**
 * Disconnect a client.
 * @swagger
 * /fedcm/disconnect:
 *   post:
 *     summary: Disconnect Client
 *     description: Revokes the user's approval for a specific client (RP).
 *     tags: [FedCM]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_id
 *               - account_hint
 *             properties:
 *               client_id:
 *                 type: string
 *               account_hint:
 *                 type: string
 *     responses:
 *       200:
 *         description: Disconnected successfully
 *       400:
 *         description: Client not connected or bad request
 *       401:
 *         description: Account hint mismatch
 */
router.post(
  '/disconnect',
  fedcmCheck,
  apiAclCheck(ApiType.SignedIn),
  (req: Request, res: Response): void => {
    const {account_hint, client_id} = req.body;

    const {user} = res.locals;

    // TODO: Use PPID instead
    if (account_hint !== user.id) {
      console.error("Account hint doesn't match.");
      res.status(401).json({ error: "Account hint doesn't match." });
      return;
    }

    // Ensure approved_clients is an array to prevent runtime errors.
    if (!user.approved_clients) {
      user.approved_clients = [];
    }

    // Use .includes() for arrays, not .has()
    if (!user.approved_clients.includes(client_id)) {
      console.error('The client is not connected.');
      res.status(400).json({ error: 'The client is not connected.' });
      return;
    }

    // Remove the client ID from the `approved_clients` list.
    user.approved_clients = user.approved_clients.filter(
      (_client_id: Base64URLString) => _client_id !== client_id
    );
    Users.update(user);
    res.json({ account_id: user.id });
  }
);

export {router as fedcm};
