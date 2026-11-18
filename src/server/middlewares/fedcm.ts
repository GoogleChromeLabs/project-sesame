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

import {Router, Request, Response} from 'express';
import jwt from 'jsonwebtoken';

import {config} from '../config.ts';
import {compareUrls, getRequestContext} from '../libs/helpers.ts';
import {RelyingParties} from '../libs/relying-parties.ts';
import {Users} from '../libs/users.ts';
import cors from 'cors';
import helmet from 'helmet';
import {csrfCheck, fedcmCheck, getTime} from '../middlewares/common.ts';
import {ApiType, apiAclCheck} from '../libs/session.ts';
import {logger} from '../libs/logger.ts';

const router = Router();

const fedcmCors = cors({
  origin: true,
  credentials: true,
});

router.use(
  helmet({
    crossOriginResourcePolicy: {policy: 'cross-origin'},
  })
);

router.options('/config.json', fedcmCors);
router.options('/accounts', fedcmCors);
router.options('/metadata', fedcmCors);
router.options('/idtokens', fedcmCors);
router.options('/disconnect', fedcmCors);

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
  fedcmCors,
  apiAclCheck(ApiType.NoAuth),
  (req: Request, res: Response) => {
    res.json({
      accounts_endpoint: `${config.origin}/fedcm/accounts`,
      client_metadata_endpoint: `${config.origin}/fedcm/metadata`,
      id_assertion_endpoint: `${config.origin}/fedcm/idtokens`,
      disconnect_endpoint: `${config.origin}/fedcm/disconnect`,
      login_url: `${config.origin}${config.idp_login_path}`,
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
  fedcmCors,
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
  fedcmCors,
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
  fedcmCors,
  fedcmCheck,
  apiAclCheck(ApiType.SignedIn),
  async (req: Request, res: Response): Promise<void> => {
    const {
      client_id,
      account_id,
      consent_acquired,
      disclosure_text_shown,
      params,
    } = req.body ?? {};
    const {user} = res.locals;

    if (typeof client_id !== 'string' || !client_id.trim()) {
      res.status(400).json({error: 'Invalid client_id.'});
      return;
    }

    const rp = await RelyingParties.findByClientID(client_id);

    // Error when: the RP is not registered.
    if (!rp) {
      const message = `RP not registered. Client ID: ${client_id}`;
      logger.error(message);
      res.status(400).json({error: message});
      return;
    }
    // Error when: The RP URL does not match the requesting origin.
    if (!compareUrls(rp.origin, req.headers.origin)) {
      const message = `RP origin doesn't match: ${rp.origin}`;
      logger.error(message);
      res.status(400).json({error: message});
      return;
    }
    // Error when: the account does not match who is currently signed in.
    if (typeof account_id !== 'string' || account_id !== user.id) {
      const message = `Account ID doesn't match: ${account_id}`;
      logger.error(message);
      res.status(400).json({error: message});
      return;
    }

    // TODO: Should it reject if consent is not acquired?
    if (
      (consent_acquired === 'true' || disclosure_text_shown === 'true') &&
      (!user.approved_clients || !user.approved_clients.includes(rp.client_id))
    ) {
      logger.info('The user is registering to the RP.');
      const existing = await Users.findById(user.id);
      const baseUser = existing ?? user;
      const approvedClients = Array.from(
        new Set([...(baseUser.approved_clients ?? []), rp.client_id])
      );
      await Users.update({
        ...baseUser,
        approved_clients: approvedClients,
      });
      user.approved_clients = approvedClients;
      if (req.session?.user) {
        req.session.user.approved_clients = approvedClients;
      }
    } else {
      logger.info('The user is signing in to the RP.');
    }

    let nonce: unknown = req.body?.nonce;
    if (params) {
      try {
        const parsed = typeof params === 'string' ? JSON.parse(params) : params;
        nonce = parsed?.nonce ?? nonce;
      } catch {
        res.status(400).json({error: 'Invalid params'});
        return;
      }
    }
    if (
      nonce !== undefined &&
      (typeof nonce !== 'string' || nonce.length > 512)
    ) {
      res.status(400).json({error: 'Invalid nonce'});
      return;
    }

    try {
      const token = jwt.sign(
        {
          iss: config.origin,
          sub: user.id,
          aud: client_id,
          nonce,
          exp: Math.floor(getTime(config.id_token_lifetime) / 1000),
          iat: Math.floor(getTime() / 1000),
          name: `${user.displayName}`,
          email: user.username,
          picture: user.picture,
        },
        rp.secret
      );

      res.json({token});
    } catch (error) {
      res.status(400).json({error: 'Invalid params'});
    }
  }
);

/**
 * Generates a JWT for the signed-in user with the provided nonce.
 * This endpoint is used by the same-origin `/iframe-federation` flow on the IdP
 * to issue a token that can be posted to the parent RP frame.
 */
router.post(
  '/createToken',
  csrfCheck,
  apiAclCheck(ApiType.SignedIn),
  async (req: Request, res: Response): Promise<void> => {
    const requestOrigin = req.headers.origin;
    if (
      requestOrigin !== undefined &&
      !compareUrls(getRequestContext(req).origin, requestOrigin)
    ) {
      logger.error('Cross-origin createToken request rejected:', requestOrigin);
      res.status(403).json({error: 'Cross-origin request not allowed.'});
      return;
    }

    const {nonce, rp_origin} = req.body ?? {};
    const {user} = res.locals;

    if (
      typeof nonce !== 'string' ||
      nonce.trim().length === 0 ||
      nonce.length > 512
    ) {
      const message = 'Nonce must be a non-empty string.';
      logger.error(message);
      res.status(400).json({error: message});
      return;
    }

    const rp = await RelyingParties.findByOrigin(rp_origin);
    if (!rp) {
      const message = 'Requesting RP not registered.';
      logger.error(message, rp_origin);
      res.status(400).json({error: message});
      return;
    }

    try {
      const token = jwt.sign(
        {
          iss: config.origin,
          sub: user.id,
          aud: rp.client_id,
          nonce,
          exp: Math.floor(getTime(config.id_token_lifetime) / 1000),
          iat: Math.floor(getTime() / 1000),
          name: `${user.displayName}`,
          email: user.username,
          picture: user.picture,
        },
        rp.secret
      );

      res.json({token});
    } catch (e: any) {
      logger.error(e);
      res.status(500).json({error: 'Failed to generate token.'});
    }
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
  fedcmCors,
  fedcmCheck,
  apiAclCheck(ApiType.SignedIn),
  async (req: Request, res: Response): Promise<void> => {
    const {account_hint, client_id} = req.body ?? {};
    const {user} = res.locals;

    if (
      typeof client_id !== 'string' ||
      !client_id.trim() ||
      typeof account_hint !== 'string' ||
      !account_hint.trim()
    ) {
      res
        .status(400)
        .json({error: 'Missing or invalid client_id or account_hint.'});
      return;
    }

    const rp = await RelyingParties.findByClientID(client_id);
    if (!rp) {
      const message = `RP not registered. Client ID: ${client_id}`;
      logger.error(message);
      res.status(400).json({error: message});
      return;
    }

    if (!compareUrls(rp.origin, req.headers.origin)) {
      const message = `RP origin doesn't match: ${rp.origin}`;
      logger.error(message);
      res.status(400).json({error: message});
      return;
    }

    // TODO: Use PPID instead
    if (account_hint !== user.id) {
      logger.error("Account hint doesn't match.");
      res.status(401).json({error: "Account hint doesn't match."});
      return;
    }

    const existing = await Users.findById(user.id);
    const baseUser = existing ?? user;
    const currentApproved = baseUser.approved_clients ?? [];

    if (!currentApproved.includes(rp.client_id)) {
      logger.error('The client is not connected.');
      res.status(400).json({error: 'The client is not connected.'});
      return;
    }

    // Remove the client ID from the `approved_clients` list.
    const updatedClients = currentApproved.filter(
      (_client_id: string) => _client_id !== rp.client_id
    );
    await Users.update({
      ...baseUser,
      approved_clients: updatedClients,
    });
    user.approved_clients = updatedClients;
    if (req.session?.user) {
      req.session.user.approved_clients = updatedClients;
    }
    res.json({account_id: user.id});
  }
);

export {router as fedcm};
