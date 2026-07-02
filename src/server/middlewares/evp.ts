/*
 * @license
 * Copyright 2026 Google Inc. All rights reserved.
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
import dns from 'node:dns/promises';
import crypto from 'node:crypto';
import {config} from '../config.ts';
import {
  SessionService,
  PageType,
  ApiType,
  pageAclCheck,
  apiAclCheck,
} from '../libs/session.ts';
import {logger} from '../libs/logger.ts';
import {generateRandomString} from '../libs/helpers.ts';

const WELL_KNOWN_ISSUERS: Record<
  string,
  {
    metadata: any;
    jwks: any;
  }
> = {
  'https://accounts.google.com': {
    metadata: {
      issuance_endpoint:
        'https://accounts.google.com/gsi/email-verification/issue',
      jwks_uri:
        'https://verifiablecredentials-pa.googleapis.com/.well-known/vc-public-jwks',
      signing_alg_values_supported: ['EdDSA'],
    },
    jwks: {
      keys: [
        {
          key_ops: ['verify'],
          crv: 'Ed25519',
          use: 'sig',
          x: 'GuNteO__TGPZ6Cg_QAkHaAgeVsxjevVjnCOQhEtihP8',
          alg: 'EdDSA',
          kty: 'OKP',
        },
        {
          crv: 'Ed25519',
          key_ops: ['verify'],
          use: 'sig',
          x: 's67dqUq-JC_3eqZzxM7O2hfSrlr8zU-mJppb-GDH0a0',
          alg: 'EdDSA',
          kty: 'OKP',
        },
        {
          key_ops: ['verify'],
          crv: 'Ed25519',
          use: 'sig',
          x: 'YLc8EhrIA5eCj7501gSxdgYk0_NSKqkf83aVLBH5y-Y',
          alg: 'EdDSA',
          kty: 'OKP',
        },
        {
          kty: 'OKP',
          alg: 'EdDSA',
          x: 'ETW0l_0paWEjHBGvZ70Ljs3IAXaZvqU4nWSA0UbvBuI',
          key_ops: ['verify'],
          crv: 'Ed25519',
          use: 'sig',
        },
        {
          alg: 'EdDSA',
          kty: 'OKP',
          crv: 'Ed25519',
          key_ops: ['verify'],
          use: 'sig',
          x: 'dCCZZmy3Zuy8R8i0ed0GEa0Hhqum2OrhR1lJ7x4vN_E',
        },
      ],
    },
  },
};

const router = Router();

/**
 * Helper to decode JWT parts
 */
interface DecodedJwt {
  header: any;
  payload: any;
  parts: string[];
}

function decodeJwt(jwtString: string): DecodedJwt {
  const parts = jwtString.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid JWT format');
  }
  const header = JSON.parse(
    Buffer.from(parts[0], 'base64url').toString('utf8')
  );
  const payload = JSON.parse(
    Buffer.from(parts[1], 'base64url').toString('utf8')
  );
  return {header, payload, parts};
}

/**
 * Render the EVP page
 */
router.get(
  '/',
  pageAclCheck(PageType.NoAuth),
  (req: Request, res: Response) => {
    const nonce = new SessionService(req.session).setChallenge(
      generateRandomString(24)
    );
    res.render('evp.html', {
      title: 'EVP Verifier',
      nonce,
    });
  }
);

/**
 * Verify the EVP token
 */
router.post(
  '/verify',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response): Promise<void> => {
    const {email, evt} = req.body;

    if (!email || !evt) {
      res.status(400).json({error: 'Missing email or token (evt)'});
      return;
    }

    const expectedNonce = new SessionService(req.session).getChallenge();

    const steps: any = {
      step1: {status: 'pending', inputs: {}, outputs: {}},
      step2: {status: 'pending', inputs: {}, outputs: {}},
      step3: {status: 'pending', inputs: {}, outputs: {}},
      step4: {status: 'pending', inputs: {}, outputs: {}},
      step5: {status: 'pending', inputs: {}, outputs: {}},
      step6: {status: 'pending', inputs: {}, outputs: {}},
    };

    let success = false;
    let errorMsg = '';
    let verifiedEmail = '';

    try {
      // =========================================================================
      // Step 1: Token Decomposition & Parsing
      // =========================================================================
      steps.step1.inputs = {rawToken: evt};
      const evtParts = evt.split('~');
      if (evtParts.length !== 2) {
        throw new Error(
          'Invalid token format: Expected [SD-JWT_Issuance_Token]~[KB-JWT_Presentation_Token]'
        );
      }
      const [sdJwtString, kbJwtString] = evtParts;

      const decodedEvt = decodeJwt(sdJwtString);
      const decodedKb = decodeJwt(kbJwtString);

      steps.step1.outputs = {
        evtHeader: decodedEvt.header,
        evtPayload: decodedEvt.payload,
        kbHeader: decodedKb.header,
        kbPayload: decodedKb.payload,
      };
      steps.step1.status = 'success';

      // =========================================================================
      // Step 2: Local Claims & Session Binding Verification
      // =========================================================================
      const tokenEmail = decodedEvt.payload.email;
      const emailVerifiedClaim = decodedEvt.payload.email_verified;
      const tokenAudience = decodedKb.payload.aud;
      const tokenNonce = decodedKb.payload.nonce;
      const tokenHash = decodedKb.payload.sd_hash;

      const calculatedEvtHash = crypto
        .createHash('sha256')
        .update(sdJwtString + '~')
        .digest('base64url');

      const protocol =
        (req.headers['x-forwarded-proto'] as string) || req.protocol;
      const host =
        (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
      const expectedAudience = `${protocol}://${host}`;

      steps.step2.inputs = {
        submittedEmail: email,
        tokenEmail,
        emailVerifiedClaim,
        expectedAudience,
        tokenAudience,
        expectedNonce,
        tokenNonce,
        calculatedEvtHash,
        tokenHash,
      };

      if (
        !email ||
        email.trim().toLowerCase() !== tokenEmail.trim().toLowerCase()
      ) {
        throw new Error(
          `Email mismatch: Submitted "${email}", Token contained "${tokenEmail}"`
        );
      }
      if (emailVerifiedClaim !== true) {
        throw new Error('Email verified claim is not true.');
      }

      const expectedHost = new URL(expectedAudience).host;
      const tokenHost = new URL(tokenAudience).host;
      if (expectedHost !== tokenHost) {
        throw new Error(
          `Audience mismatch: Expected "${expectedAudience}", Token contained "${tokenAudience}"`
        );
      }

      if (expectedNonce && tokenNonce !== expectedNonce) {
        throw new Error(
          `Nonce mismatch: Expected "${expectedNonce}", Token contained "${tokenNonce}"`
        );
      }

      if (calculatedEvtHash !== tokenHash) {
        throw new Error(
          `Hash binding mismatch: Calculated "${calculatedEvtHash}", Token contained "${tokenHash}"`
        );
      }

      steps.step2.outputs = {localChecksPassed: true};
      steps.step2.status = 'success';

      // =========================================================================
      // Step 3: DNS Delegation Authority Verification
      // =========================================================================
      const tokenIssuer = decodedEvt.payload.iss;
      const emailDomain = email.split('@')[1];
      const dnsLookupTarget = `_email-verification.${emailDomain}`;

      steps.step3.inputs = {
        submittedEmail: email,
        tokenIssuer,
        dnsLookupTarget,
      };

      let isDelegated = false;
      let authorizedBy = '';

      const issuerUrl = new URL(tokenIssuer);
      const issuerHost = issuerUrl.hostname;

      if (emailDomain.toLowerCase() === issuerHost.toLowerCase()) {
        isDelegated = true;
        authorizedBy = 'Direct Domain Equality (Self-Authoritative)';
      } else {
        let dnsTxtRecords: string[][] = [];
        try {
          dnsTxtRecords = await dns.resolveTxt(dnsLookupTarget);
        } catch (e: any) {
          logger.error(`DNS lookup failed for ${dnsLookupTarget}:`, e);
        }

        isDelegated = dnsTxtRecords.some(record =>
          record.some(str => str.includes(`iss=${issuerHost}`))
        );
        authorizedBy = 'DNS TXT Record Delegation';
      }

      if (!isDelegated) {
        throw new Error(
          `Domain ${emailDomain} has not delegated verification authority to issuer ${tokenIssuer}`
        );
      }

      steps.step3.outputs = {authorizedBy};
      steps.step3.status = 'success';

      // =========================================================================
      // Step 4: Issuer Discovery & JWKS Fetching
      // =========================================================================
      const discoveryUrl = `${tokenIssuer}/.well-known/email-verification`;
      steps.step4.inputs = {url: discoveryUrl};

      let issuerMetadata: any;
      let issuerJWKS: any;

      const knownIssuer = WELL_KNOWN_ISSUERS[tokenIssuer];
      if (knownIssuer && process.env.VITEST !== 'true') {
        issuerMetadata = knownIssuer.metadata;
        issuerJWKS = knownIssuer.jwks;
        steps.step4.outputs = {
          message:
            '[LOCAL BYPASS] Used local metadata and JWKS to avoid corporate network proxy blocks',
          issuerMetadata,
          issuerJWKS,
        };
      } else {
        // Fetch well-known config
        const wellKnownRes = await fetch(discoveryUrl);
        if (!wellKnownRes.ok) {
          throw new Error(
            `Failed to fetch issuer metadata from ${discoveryUrl}`
          );
        }
        issuerMetadata = await wellKnownRes.json();

        // Fetch JWKS
        const jwksRes = await fetch(issuerMetadata.jwks_uri);
        if (!jwksRes.ok) {
          throw new Error(
            `Failed to fetch JWKS from ${issuerMetadata.jwks_uri}`
          );
        }
        issuerJWKS = await jwksRes.json();

        steps.step4.outputs = {
          issuerMetadata,
          issuerJWKS,
        };
      }
      steps.step4.status = 'success';

      // =========================================================================
      // Step 5: Issuer Signature Cryptographic Verification
      // =========================================================================
      steps.step5.inputs = {
        signingAlg: decodedEvt.header.alg || 'EdDSA',
        kid: decodedEvt.header.kid,
      };

      const kid = decodedEvt.header.kid;
      const signingInput = `${decodedEvt.parts[0]}.${decodedEvt.parts[1]}`;
      const data = Buffer.from(signingInput, 'utf8');
      const signature = Buffer.from(decodedEvt.parts[2], 'base64url');

      const keysToTry = kid
        ? issuerJWKS.keys.filter((k: any) => k.kid === kid)
        : issuerJWKS.keys;

      let signatureVerified = false;
      for (const jwk of keysToTry) {
        try {
          const publicKey = crypto.createPublicKey({format: 'jwk', key: jwk});
          signatureVerified = crypto.verify(
            undefined,
            data,
            publicKey,
            signature
          );
          if (signatureVerified) {
            steps.step5.outputs = {verifiedKey: jwk};
            break;
          }
        } catch (e) {
          // Continue trying other keys
        }
      }

      if (!signatureVerified) {
        throw new Error(
          'Failed to verify SD-JWT signature against issuer public keys'
        );
      }
      steps.step5.status = 'success';

      // =========================================================================
      // Step 6: Ephemeral Key Binding Cryptographic Verification
      // =========================================================================
      const ephemeralPublicKey = decodedEvt.payload.cnf?.jwk;
      if (!ephemeralPublicKey) {
        throw new Error(
          'Missing ephemeral key binding (cnf.jwk) in SD-JWT payload'
        );
      }

      steps.step6.inputs = {
        cnf: decodedEvt.payload.cnf,
        kbJwt: kbJwtString,
      };

      const kbSigningInput = `${decodedKb.parts[0]}.${decodedKb.parts[1]}`;
      const kbData = Buffer.from(kbSigningInput, 'utf8');
      const kbSignature = Buffer.from(decodedKb.parts[2], 'base64url');

      let kbSignatureVerified = false;
      try {
        const kbPublicKey = crypto.createPublicKey({
          format: 'jwk',
          key: ephemeralPublicKey,
        });
        kbSignatureVerified = crypto.verify(
          undefined,
          kbData,
          kbPublicKey,
          kbSignature
        );
      } catch (e: any) {
        throw new Error(`Failed to import ephemeral public key: ${e.message}`);
      }

      if (!kbSignatureVerified) {
        throw new Error(
          'Failed to verify KB-JWT signature using ephemeral public key'
        );
      }

      steps.step6.outputs = {keyBindingPassed: true};
      steps.step6.status = 'success';

      success = true;
      verifiedEmail = tokenEmail;
    } catch (error: any) {
      logger.error('EVP Verification error:', error);
      errorMsg = error.message || 'Verification failed';

      // Determine which step failed to mark it in the trace
      for (let i = 1; i <= 6; i++) {
        const stepKey = `step${i}`;
        if (steps[stepKey].status === 'pending') {
          steps[stepKey].status = 'failed';
          steps[stepKey].outputs = {error: errorMsg};
          break;
        }
      }
    }

    res.json({
      success,
      verifiedEmail,
      error: errorMsg,
      steps,
    });
  }
);

export {router as evp};
