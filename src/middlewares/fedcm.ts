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

import { config } from "../config.js";
import express, { Request, Response } from "express";
const router = express.Router();
import { Users } from "../libs/users.js";
import * as jwt from "jsonwebtoken";
import { csrfCheck, getTime } from "./common.js";
import { SignInStatus, sessionCheck } from "./session.js";
import { RelyingParties } from "../libs/relying-parties.js";
import { compareUrls } from "../libs/helpers.js";
import { Base64URLString } from "@simplewebauthn/types";

router.get("/config.json", (req: Request, res: Response): any => {
  return res.json({
    accounts_endpoint: "/fedcm/accounts",
    client_metadata_endpoint: "/fedcm/metadata",
    id_assertion_endpoint: "/fedcm/idtokens",
    disconnect_endpoint: "/fedcm/disconnect",
    login_url: "/identifier-first-form",
    branding: {
      background_color: "#6200ee",
      color: "#ffffff",
      icons: [
        {
          url: `${config.origin}/images/favicon.svg`,
          size: 256,
        },
      ],
    },
  });
});

router.get(
  "/accounts",
  csrfCheck,
  sessionCheck,
  (req: Request, res: Response): any => {
    const user = res.locals.user;

    if (res.locals.signin_status < SignInStatus.SignedIn) {
      return res.status(401).json({ error: "not signed in" });
    }

    return res.json({
      accounts: [
        {
          id: user.id,
          name: user.displayName,
          email: user.username,
          picture: user.picture,
          approved_clients: [],
        },
      ],
    });
  }
);

router.get("/metadata", (req: Request, res: Response): any => {
  return res.json({
    privacy_policy_url: `${config.origin}/privacy_policy`,
    terms_of_service_url: `${config.origin}/terms_of_service`,
  });
});

router.post(
  "/idtokens",
  csrfCheck,
  sessionCheck,
  async (req: Request, res: Response): Promise<any> => {
    const {
      client_id,
      nonce,
      account_id,
      consent_acquired,
      disclosure_text_shown,
    } = req.body;
    let { user, signin_status } = res.locals.user;

    if (signin_status < SignInStatus.SignedIn) {
      return res.status(401).json({ error: { 'code': 'access_denied' }});
    }

    const rp = await RelyingParties.findByClientID(client_id);

    // Error when:
    // * the RP is not registered.
    // * The RP URL matches the requesting origin.
    // * the account does not match who is currently signed in.
    // TODO: Apply the Error API https://developers.google.com/privacy-sandbox/3pcd/fedcm-developer-guide#error-response
    if (
      !rp ||
      !compareUrls(rp.origin, req.headers.origin) ||
      account_id !== user.id
    ) {
      console.error("Invalid request.", req.body);
      return res.status(400).json({ error: "Invalid request." });
    }

    // TODO: Should it reject if consent is not acquired?
    if (
      consent_acquired === "true" ||
      disclosure_text_shown === "true" ||
      !user.approved_clients.includes(rp.client_id)
    ) {
      console.log("The user is registering to the RP.");
      user.approved_clients.push(rp.client_id);
      Users.update(user);
    } else {
      console.log("The user is signing in to the RP.");
    }

    if (user.status === "") {
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
        process.env.SECRET
      );

      return res.json({ token });
    } else {
      let error_code = 401;
      switch (user.status) {
        case "server_error":
          error_code = 500;
          break;
        case "temporarily_unavailable":
          error_code = 503;
          break;
        default:
          error_code = 401;
      }
      return res.status(error_code).json({
        error: {
          code: user.status,
          url: `${config.origin}/error.html&type=${user.status}`,
        },
      });
    }
  }
);

router.post(
  "/disconnect",
  csrfCheck,
  sessionCheck,
  (req: Request, res: Response): any => {
    const { account_hint, client_id } = req.body;

    const user = res.locals.user;

    // TODO: Use PPID instead
    if (account_hint !== user.id) {
      console.error("Account hint doesn't match.");
      return res.status(401).json({ error: "Account hint doesn't match." });
    }

    if (!user.approved_clients.has(client_id)) {
      console.error("The client is not connected.");
      return res.status(400).json({ error: "The client is not connected." });
    }

    // Remove the client ID from the `approved_clients` list.
    user.approved_clients = user.approved_clients.filter(
      (_client_id: Base64URLString) => _client_id !== client_id
    );
    Users.update(user);
    return res.json({ account_id: user.id });
  }
);

export { router as fedcm };
