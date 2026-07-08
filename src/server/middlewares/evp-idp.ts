/*
 * Copyright 2026 Google LLC
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
 * limitations under the License.
 */

import {Router, Request, Response} from 'express';
import crypto from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import {EVP_PRIVATE_KEY_JWK, EVP_PUBLIC_KEY_JWK} from '../libs/evp-keys.ts';
import {apiAclCheck, ApiType, pageAclCheck, PageType} from '../libs/session.ts';
import {logger} from '../libs/logger.ts';
import {config} from '../config.ts';

const router = Router();

/**
 * Renders the EVP Mock Identity Provider landing/sign-in page.
 */
router.get(
  '/',
  pageAclCheck(PageType.NoAuth),
  (req: Request, res: Response): void => {
    const isIdp = config.project_name === 'sesame-identity-provider';
    if (!isIdp) {
      const idpOrigin = config.primary_idp_origin || 'https://idp.localhost';
      res.redirect(`${idpOrigin}/evp-idp`);
      return;
    }
    const idpDomain = config.hostname;
    res.render('evp-idp.html', {
      title: 'EVP Email Provider',
      isIdp,
      idpDomain,
    });
  }
);

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
 * Helper to sign payload using Ed25519 EdDSA
 */
function signEdDSA(payload: any, privateKeyJwk: any): string {
  const header = {
    alg: 'EdDSA',
    kid: privateKeyJwk.kid,
    typ: 'evt+jwt',
  };

  const base64UrlEncode = (obj: any) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const headerPart = base64UrlEncode(header);
  const payloadPart = base64UrlEncode(payload);
  const signingInput = `${headerPart}.${payloadPart}`;

  const privateKey = crypto.createPrivateKey({
    format: 'jwk',
    key: privateKeyJwk,
  });

  const signature = crypto.sign(
    undefined,
    Buffer.from(signingInput, 'utf8'),
    privateKey
  );

  return `${signingInput}.${signature.toString('base64url')}`;
}

/**
 * Helper to base64url decode a string
 */
function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Endpoint to serve the JWKS.
 */
router.get('/jwks', (req: Request, res: Response): void => {
  res.json({
    keys: [EVP_PUBLIC_KEY_JWK],
  });
});

/**
 * Endpoint to process token requests and issue EVP tokens.
 */
router.post(
  '/issuance',
  apiAclCheck(ApiType.SignedIn),
  async (req: Request, res: Response): Promise<void> => {
    const {user} = res.locals;
    const requestOrigin = req.headers.origin;

    // Set CORS headers for credentialed request
    if (requestOrigin) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    try {
      const secFetchDest = req.headers['sec-fetch-dest'];
      if (
        secFetchDest &&
        secFetchDest !== 'email-verification' &&
        secFetchDest !== 'webidentity'
      ) {
        logger.warn(`Unexpected Sec-Fetch-Dest header: ${secFetchDest}`);
      }

      // Read standard forms or JSON bodies
      const requestToken = req.body.request_token || req.body.email;

      if (!requestToken) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing request_token in body.',
        });
        return;
      }

      let email = '';
      let browserJwk: any = undefined;

      // Verify the Proof-of-Possession request token
      if (requestToken.includes('.')) {
        const parts = requestToken.split('.');
        if (parts.length !== 3) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'Malformed request token.',
          });
          return;
        }

        const header = JSON.parse(base64UrlDecode(parts[0]));
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        const signature = Buffer.from(parts[2], 'base64url');

        browserJwk = header.jwk;
        if (!browserJwk) {
          res.status(400).json({
            error: 'invalid_signature',
            error_description:
              'Missing ephemeral public key (jwk) in request token header.',
          });
          return;
        }

        // Verify the browser signature (usually ES256)
        const alg = header.alg || 'ES256';
        const signingInput = `${parts[0]}.${parts[1]}`;

        const publicKey = crypto.createPublicKey({
          format: 'jwk',
          key: browserJwk,
        });

        const signatureVerified = crypto.verify(
          undefined,
          Buffer.from(signingInput, 'utf8'),
          browserJwk.kty === 'EC'
            ? {key: publicKey, dsaEncoding: 'ieee-p1363'}
            : publicKey,
          signature
        );

        if (!signatureVerified) {
          res.status(400).json({
            error: 'invalid_signature',
            error_description: 'Failed to verify request token signature.',
          });
          return;
        }

        email = payload.email;
      } else {
        email = requestToken;
      }

      // Check if the requested email matches the logged-in user
      if (email.toLowerCase() !== user.username.toLowerCase()) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: `Requested email ${email} does not match signed-in user ${user.username}`,
        });
        return;
      }

      if (!browserJwk) {
        browserJwk = {
          kty: 'EC',
          crv: 'P-256',
          x: 'dV4TUV9zA_0Ssy5Y91xheN57NKDryji2c3Qy6he6sw4',
          y: 'A-oMMDlM_ML_jiZMIQqU4ZmZSEpW3sH62-x2LlRLuyU',
        };
      }

      // Sign and issue EVT
      const origin = `${req.protocol}://${req.get('host')}`;
      const evtPayload = {
        iss: origin,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
        cnf: {
          jwk: browserJwk,
        },
        email: user.username,
        email_verified: true,
      };

      const signedEvt = signEdDSA(evtPayload, EVP_PRIVATE_KEY_JWK);
      const issuanceToken = `${signedEvt}~`;

      res.json({
        issuance_token: issuanceToken,
      });
    } catch (error: any) {
      logger.error('EVP Issuance error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: error.message,
      });
    }
  }
);

export {router as evpIdp};
