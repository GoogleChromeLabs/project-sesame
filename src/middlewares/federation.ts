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

import express from "express";
const router = express.Router();
import { Users } from "../libs/users.js";
import { IdentityProviders } from "../libs/identity-providers.js";
import { FederationMappings } from "../libs/federation-mappings.js";
import jwt, { JwtPayload } from "jsonwebtoken";
import { csrfCheck, sessionCheck } from "./common.js";

interface IdToken extends JwtPayload {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

router.post("/idp", async (req, res) => {
  const { url } = req.body;
  const idp = await IdentityProviders.findByURL(url);
  if (!idp) {
    return res
      .status(404)
      .json({ error: "No matching identity provider found." });
  }
  idp.secret = "";
  return res.json(idp);
});

router.post("/verify", csrfCheck, async (req, res) => {
  const { token: raw_token, url } = req.body;
  // console.error(raw_token);

  try {
    const expected_nonce = req.session.nonce.toString();

    const idp = await IdentityProviders.findByURL(url);

    if (!idp) {
      throw new Error("Identity provider not found.");
    }

    const token = <IdToken>jwt.verify(raw_token, idp.secret, {
      issuer: idp.origin,
      nonce: expected_nonce,
      audience: idp.clientId,
    });

    if (!token.email) {
      throw new Error("`email` is missing in the ID token.");
    }

    /*
      Example JWT:
      {
        "iss": "https://fedcm-idp-demo.glitch.me",
        "sub": "9KfiqUb2N0fhlffvzhO3DoZl2WipjVDhjgefWDzR1Rw",
        "aud": "https://identity-demos.dev",
        "nonce": "81805668362",
        "exp": 1706941073707,
        "iat": 1706854673707,
        "name": "Elisa Beckett",
        "email": "demo@example.com",
        "given_name": "Elisa",
        "family_name": "Beckett",
        "picture": "https://gravatar.com/avatar/e0c52c473bfcdb168d3b183699668f96a4fa1ac19534b8e96fe215dcaf36ef02?size=256"
      }
    */

    // Find a matching user by querying with the email address
    // TODO: Beware that the email is verified.
    let user = await Users.findByUsername(token.email);
    if (user && token.iss) {
      const map = FederationMappings.findByIssuer(token.iss);
      if (!map) {
        // If the email address matches, merge the user.
        FederationMappings.create(user.id, token);
      } else {
        // TODO: Think about how each IdP provided properties match against RP's.
      }
    } else {
      // If the user does not exist yet, create a new user.
      user = await Users.create(token.email, {
        email: token.email,
        displayName: token.name,
        picture: token.picture,
      });
      FederationMappings.create(user.id, token);
    }

    req.session.username = token.email;
    req.session["signed-in"] = "yes";

    // Set a login status using the Login Status API
    res.set("Set-Login", "logged-in");

    return res.status(200).json(user);
  } catch (error: any) {
    console.error(error.message);
    return res.status(401).json({ error: "ID token verification failed." });
  }
});

export { router as federation };
