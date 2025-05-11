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
import {
  FederationMap,
  FederationMappings,
} from '../libs/federation-mappings.ts';
import {IdentityProviders} from '../libs/identity-providers.ts';
import {OAuth2Client} from 'google-auth-library';
import {Users} from '../libs/users.ts';
import {csrfCheck} from '../middlewares/common.ts';
import {
  apiAclCheck,
  ApiType,
  getChallenge,
  setSignedIn,
} from '../middlewares/session.ts';

const router = Router();
const googleClient = new OAuth2Client();

router.use(csrfCheck);

router.post(
  '/idp',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response) => {
    const idps = [];
    const {urls} = req.body;
    try {
      for (let _url of urls) {
        const url = new URL(_url);
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
  }
);

router.get(
  '/mappings',
  apiAclCheck(ApiType.SignedIn),
  async (req: Request, res: Response) => {
    const {user} = res.locals;
    try {
      const maps = await FederationMappings.findByUserId(user.id);
      return res.json(maps);
    } catch (e: any) {
      console.error(e);
      return res.status(400).json({error: e.message});
    }
  }
);

router.post(
  '/verifyIdToken',
  apiAclCheck(ApiType.SignIn),
  async (req: Request, res: Response) => {
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

      let payload;
      if (idp.origin === 'https://accounts.google.com') {
        const ticket = await googleClient.verifyIdToken({
          idToken: raw_token,
          audience: idp.clientId,
        });
        payload = ticket.getPayload();
      } else {
        payload = <FederationMap>jwt.verify(raw_token, idp.secret, {
          issuer: idp.origin,
          nonce: expected_nonce,
          audience: idp.clientId,
        });
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
      }

      if (!payload?.email) {
        throw new Error('`email` is missing in the ID token.');
      }

      // Find a matching user by querying with the email address
      // TODO: Beware that the email is verified.
      let user = await Users.findByUsername(payload.email);
      if (user && payload.iss) {
        const maps = await FederationMappings.findByIssuer(payload.iss);
        if (maps.length === 0) {
          // If the email address matches, merge the user.
          FederationMappings.create(user.id, payload);
        } else {
          // TODO: Think about how each IdP provided properties match against RP's.
          console.log('More than 1 federation mappings found:', maps);
        }
      } else {
        // If the user does not exist yet, create a new user.
        user = await Users.create(payload.email, {
          email: payload.email,
          displayName: payload.name,
          picture: payload.picture,
        });
        FederationMappings.create(user.id, payload);
      }

      // Set the user as a signed in status
      setSignedIn(user, req, res);

      return res.status(200).json(user);
    } catch (error: any) {
      console.error(error.message);
      return res.status(401).json({error: 'ID token verification failed.'});
    }
  }
);

router.post(
  '/verifySdJwt',
  apiAclCheck(ApiType.SignIn),
  async (req: Request, res: Response) => {
    // Respond with static result for now.
    // TODO: Implement SD-JWT parser
    const payload = {
      iss: 'https://accounts.google.com',
      email: 'chromedemojp@gmail.com',
      name: 'Elisa Beckett',
      picture:
        'https://www.gravatar.com/avatar/e09dfabed7f7cf97dbccad33b1769000?s=200',
    };

    // Find a matching user by querying with the email address
    // TODO: Beware that the email is verified.
    let user = await Users.findByUsername(payload.email);
    if (user && payload.iss) {
      const maps = await FederationMappings.findByIssuer(payload.iss);
      if (maps.length === 0) {
        // If the email address matches, merge the user.
        FederationMappings.create(user.id, payload);
      } else {
        // TODO: Think about how each IdP provided properties match against RP's.
        console.log('More than 1 federation mappings found:', maps);
      }
    } else {
      // If the user does not exist yet, create a new user.
      user = await Users.create(payload.email, {
        email: payload.email,
        displayName: payload.name,
        picture: payload.picture,
      });
      FederationMappings.create(user.id, payload);
    }

    // Set the user as a signed in status
    setSignedIn(user, req, res);
    return res.json({});
  }
);

export {router as federation};
