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
import {Session} from 'express-session';
import dns from 'node:dns/promises';
import crypto from 'node:crypto';
import {SessionService, ApiType, apiAclCheck} from '../libs/session.ts';
import {Users, generatePasskeyUserId} from '../libs/users.ts';
import {logger} from '../libs/logger.ts';
import {generateRandomString} from '../libs/helpers.ts';
import {csrfCheck} from './common.ts';

const router = Router();

router.use(csrfCheck);

/**
 * A deliberately loose email shape check. The address is either
 * cryptographically verified through EVP or (in the simulated fallback) typed
 * by the user, so this only guards against obviously malformed input. String
 * operations are used instead of a regular expression to avoid super-linear
 * backtracking on crafted input.
 *
 * @param email - The normalized email address.
 * @returns `true` if the address has a local part and a dotted domain.
 */
function isPlausibleEmail(email: string): boolean {
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return (
    local.length > 0 &&
    domain.includes('.') &&
    !domain.startsWith('.') &&
    !domain.endsWith('.')
  );
}

/**
 * Renders the passwordless sign-up page and binds a fresh nonce to the
 * session.
 *
 * The nonce is embedded in the hidden `email-verification-token` input so the
 * browser includes it in the Key Binding JWT. This ties the Email Verification
 * Token to this particular session and prevents replay.
 *
 * This handler is exported (rather than registered on the router) so that
 * `app.ts` can mount it at the exact `/evp` path behind
 * `pageAclCheck(PageType.SignUp)`. Mounting it inside the router would make
 * `enabled_pages` see `/evp/` instead of `/evp`.
 *
 * @param req - The Express request.
 * @param res - The Express response.
 */
export function renderEvpPage(req: Request, res: Response): void {
  const sessionService = new SessionService(req.session);
  // This is a sign-up page, so point the entrance at a sign-in page that can
  // use the passkey created at the end of this flow once the user signs out.
  sessionService.setEntrancePath('/passkey-form-autofill');
  const nonce = sessionService.setChallenge(generateRandomString(24));
  res.render('evp.html', {
    title: 'Passwordless sign-up',
    nonce,
  });
}

/**
 * Puts a verified email address into the sign-up session so the user can
 * finish creating the account by registering a passkey.
 *
 * The account itself is not created here. The existing
 * `/webauthn/registerRequest` and `/webauthn/registerResponse` endpoints
 * accept users in the `SigningUp` state and create the account only after a
 * passkey has been registered successfully. That keeps the flow passwordless:
 * no account exists without a passkey.
 *
 * @param session - The Express session of the current request.
 * @param email - The email address whose ownership has been verified.
 * @returns The normalized email address used as the username.
 * @throws Error if the address can't be used or is already registered.
 */
async function startPasskeySignUp(
  session: Session,
  email: string
): Promise<string> {
  const username = email.trim().toLowerCase();
  if (!isPlausibleEmail(username) || !Users.isValidUsername(username)) {
    throw new Error('This email address cannot be used to sign up.');
  }
  // Only check for an existing account after ownership has been verified
  // (through EVP, or through a real one-time code in production) so that the
  // endpoint can't be used to probe which addresses are registered.
  const existingUser = await Users.findByUsername(username);
  if (existingUser) {
    throw new Error(
      'An account with this email address already exists. Sign in instead.'
    );
  }
  new SessionService(session).setSigningUp({
    username,
    email: username,
    displayName: '',
    passkeyUserId: generatePasskeyUserId(),
  });
  return username;
}

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
 * Verifies an Email Verification Token (EVT) and, on success, starts a
 * passwordless sign-up for the verified email address.
 *
 * The response always includes a step-by-step `steps` trace so the demo page
 * can print how the token was validated. When `success` is `true`, the session
 * is in the `SigningUp` state and the client proceeds to passkey creation.
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
      if (evtParts.length < 2) {
        throw new Error(
          'Invalid token format: Missing Key Binding JWT separator "~"'
        );
      }
      const sdJwtString = evtParts[0];
      const kbJwtString = evtParts[evtParts.length - 1];
      const disclosures = evtParts.slice(1, -1).filter(Boolean);

      const decodedEvt = decodeJwt(sdJwtString);
      const decodedKb = decodeJwt(kbJwtString);

      steps.step1.outputs = {
        evtHeader: decodedEvt.header,
        evtPayload: decodedEvt.payload,
        kbHeader: decodedKb.header,
        kbPayload: decodedKb.payload,
        disclosures,
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

      const tokenExp = decodedEvt.payload.exp || decodedKb.payload.exp;
      const tokenIat = decodedEvt.payload.iat || decodedKb.payload.iat;
      const currentTime = Math.floor(Date.now() / 1000);

      const sdJwtWithDisclosures = evtParts.slice(0, -1).join('~') + '~';
      const calculatedEvtHash = crypto
        .createHash('sha256')
        .update(sdJwtWithDisclosures)
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
        tokenExp,
        tokenIat,
        currentTime,
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

      // Fail closed: without a session-bound nonce there is nothing to bind the
      // token to, so a token issued for another session could be replayed.
      if (!expectedNonce) {
        throw new Error(
          'No verification challenge found in the session. Reload the page and try again.'
        );
      }
      if (tokenNonce !== expectedNonce) {
        throw new Error(
          `Nonce mismatch: Expected "${expectedNonce}", Token contained "${tokenNonce}"`
        );
      }

      if (calculatedEvtHash !== tokenHash) {
        throw new Error(
          `Hash binding mismatch: Calculated "${calculatedEvtHash}", Token contained "${tokenHash}"`
        );
      }

      // Timestamp validations (exp & iat)
      if (tokenExp && currentTime >= tokenExp) {
        throw new Error(
          `Token has expired. Current timestamp is ${currentTime}, but token expired at ${tokenExp}.`
        );
      }
      if (tokenIat && tokenExp && tokenIat >= tokenExp) {
        throw new Error(
          `Token timestamps are inconsistent. Issued at (iat) is ${tokenIat}, but expires at (exp) is ${tokenExp}.`
        );
      }
      if (tokenIat && currentTime - tokenIat > 300) {
        throw new Error(
          `Token is too old. Issued at ${tokenIat} (${currentTime - tokenIat}s ago), exceeding the 5-minute freshness limit.`
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

      // Fetch well-known config
      const wellKnownRes = await fetch(discoveryUrl);
      if (!wellKnownRes.ok) {
        throw new Error(`Failed to fetch issuer metadata from ${discoveryUrl}`);
      }
      const issuerMetadata = await wellKnownRes.json();

      // Fetch JWKS
      const jwksRes = await fetch(issuerMetadata.jwks_uri);
      if (!jwksRes.ok) {
        throw new Error(`Failed to fetch JWKS from ${issuerMetadata.jwks_uri}`);
      }
      const issuerJWKS = await jwksRes.json();

      steps.step4.outputs = {
        issuerMetadata,
        issuerJWKS,
      };
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

      // The nonce is single-use: consume it as soon as the token has been
      // accepted so the same token can't be replayed within this session.
      new SessionService(req.session).deleteChallenge();

      // Email ownership is proven. Start the passwordless sign-up so the
      // client can move on to passkey creation.
      verifiedEmail = await startPasskeySignUp(req.session, tokenEmail);
      success = true;
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

/**
 * Verifies a one-time code as the fallback when the browser didn't supply an
 * Email Verification Token, then starts a passwordless sign-up.
 *
 * SIMULATED: this demo doesn't send any email, so any 6-digit code is
 * accepted. A real implementation must generate a random code on the server,
 * deliver it to the address, store it with a short expiry, compare it here,
 * and rate-limit attempts.
 */
router.post(
  '/otp',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response): Promise<void> => {
    const {email, otp} = req.body;

    if (typeof email !== 'string' || typeof otp !== 'string') {
      res.status(400).json({error: 'Missing email or one-time code.'});
      return;
    }

    const sessionService = new SessionService(req.session);
    // Require the challenge set by the sign-up page so that this endpoint is
    // only reachable from a freshly loaded page in the same session.
    if (!sessionService.getChallenge()) {
      res.status(400).json({
        error: 'No sign-up in progress. Reload the page and try again.',
      });
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      res.status(400).json({error: 'Enter the 6-digit code.'});
      return;
    }

    try {
      const verifiedEmail = await startPasskeySignUp(req.session, email);
      sessionService.deleteChallenge();
      res.json({success: true, verifiedEmail});
    } catch (error: any) {
      logger.error('OTP fallback error:', error);
      res.status(400).json({error: error.message || 'Verification failed.'});
    }
  }
);

export {router as evp};
