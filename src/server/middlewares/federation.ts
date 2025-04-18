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
import jwt, {JwtPayload} from 'jsonwebtoken';
import {FederationMappings} from '../libs/federation-mappings.ts';
import {IdentityProviders} from '../libs/identity-providers.ts';
import {Users} from '../libs/users.ts';
import {csrfCheck} from '../middlewares/common.ts';
import {
  apiAclCheck,
  ApiType,
  getChallenge,
  setSessionUser,
} from '../middlewares/session.ts';

const router = express.Router();

router.use(csrfCheck);

interface IdToken extends JwtPayload {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

router.post('/idp', apiAclCheck(ApiType.NoAuth), async (req, res) => {
  const idps = [];
  const {urls} = req.body;
  try {
    for (let _url of urls) {
      const url = new URL(_url)
      const idp = await IdentityProviders.findByOrigin(url.toString());
      if (!idp) {
        return res
          .status(404)
          .json({error: 'No matching identity provider found.'});
      }
      idp.secret = '';
      idps.push(idp);
    }
    return res.json(idps);
  } catch (e: any) {
    console.error(e);
    return res.status(400).json({error: e.message});
  }
});

router.post('/verify', apiAclCheck(ApiType.Authentication), async (req, res) => {
  const {token: raw_token, url} = req.body;
  // console.error(raw_token);

  try {
    const expected_nonce = getChallenge(req, res);

    if (!expected_nonce || typeof expected_nonce !== 'string') {
      throw new Error('Invalid nonce.');
    }

    const idp = await IdentityProviders.findByOrigin(url);

    if (!idp) {
      throw new Error('Identity provider not found.');
    }

    const token = <IdToken>jwt.verify(raw_token, idp.secret, {
      issuer: idp.origin,
      nonce: expected_nonce,
      audience: idp.clientId,
    });

    if (!token.email) {
      throw new Error('`email` is missing in the ID token.');
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

    // Set the user as a signed in status
    setSessionUser(user, req, res);

    return res.status(200).json(user);
  } catch (error: any) {
    console.error(error.message);
    return res.status(401).json({error: 'ID token verification failed.'});
  }
});

export {router as federation};
