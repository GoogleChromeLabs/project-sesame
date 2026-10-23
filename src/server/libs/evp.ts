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

import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import {logger} from './logger.ts';

/**
 * Helper to decode JWT parts
 */
export interface DecodedJwt {
  header: any;
  payload: any;
  parts: string[];
}

export function decodeJwt(jwtString: string): DecodedJwt {
  const parts = jwtString.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Invalid JWT format: Expected 3 parts');
  }
  const header = JSON.parse(
    Buffer.from(parts[0], 'base64url').toString('utf8')
  );
  const payload = JSON.parse(
    Buffer.from(parts[1], 'base64url').toString('utf8')
  );
  return {header, payload, parts};
}

export interface EvpVerificationStep {
  status: 'pending' | 'success' | 'failed';
  inputs: Record<string, any>;
  outputs: Record<string, any>;
}

export interface EvpVerificationSteps {
  step1: EvpVerificationStep;
  step2: EvpVerificationStep;
  step3: EvpVerificationStep;
  step4: EvpVerificationStep;
  step5: EvpVerificationStep;
  step6: EvpVerificationStep;
  [key: string]: EvpVerificationStep;
}

export interface VerifyEvpTokenParams {
  email: string;
  evt: string;
  expectedAudience: string;
  expectedNonce?: string;
}

export interface VerifyEvpTokenResult {
  success: boolean;
  verifiedEmail: string;
  error?: string;
  steps: EvpVerificationSteps;
}

/**
 * Verify an Email Verification Token (EVT) and Key Binding JWT (KB-JWT)
 */
export async function verifyEvpToken({
  email,
  evt,
  expectedAudience,
  expectedNonce,
}: VerifyEvpTokenParams): Promise<VerifyEvpTokenResult> {
  const steps: EvpVerificationSteps = {
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
      typeof tokenEmail !== 'string' ||
      email.trim().toLowerCase() !== tokenEmail.trim().toLowerCase()
    ) {
      throw new Error(
        `Email mismatch: Submitted "${email}", Token contained "${tokenEmail}"`
      );
    }
    if (emailVerifiedClaim !== true) {
      throw new Error('Email verified claim is not true.');
    }

    const expectedOrigin = new URL(expectedAudience).origin;
    const tokenOrigin = new URL(tokenAudience).origin;
    if (expectedOrigin !== tokenOrigin) {
      throw new Error(
        `Audience mismatch: Expected origin "${expectedOrigin}", Token contained "${tokenOrigin}"`
      );
    }

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
    const emailDomain = email.includes('@')
      ? email.split('@').pop()
      : undefined;
    if (!emailDomain) {
      throw new Error(`Invalid email address format: "${email}"`);
    }
    const dnsLookupTarget = `_email-verification.${emailDomain}`;

    steps.step3.inputs = {
      submittedEmail: email,
      tokenIssuer,
      dnsLookupTarget,
    };

    let isDelegated = false;
    let authorizedBy = '';

    const issuerUrl = new URL(tokenIssuer);
    if (
      issuerUrl.protocol !== 'https:' &&
      issuerUrl.hostname !== 'localhost' &&
      issuerUrl.hostname !== '127.0.0.1'
    ) {
      throw new Error(`Issuer must use HTTPS protocol: ${tokenIssuer}`);
    }
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

      isDelegated = dnsTxtRecords.some(chunks => {
        const fullRecord = chunks.join('');
        return fullRecord
          .split(/[\s;]+/)
          .some(token => token === `iss=${issuerHost}`);
      });
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
    let cleanIssuer = tokenIssuer;
    while (cleanIssuer.endsWith('/')) {
      cleanIssuer = cleanIssuer.slice(0, -1);
    }
    const discoveryUrl = `${cleanIssuer}/.well-known/email-verification`;
    steps.step4.inputs = {url: discoveryUrl};

    // Fetch well-known config
    const wellKnownRes = await fetch(discoveryUrl);
    if (!wellKnownRes.ok) {
      throw new Error(`Failed to fetch issuer metadata from ${discoveryUrl}`);
    }
    const issuerMetadata = await wellKnownRes.json();

    // Fetch JWKS
    const jwksUrl = new URL(issuerMetadata.jwks_uri);
    if (
      jwksUrl.protocol !== 'https:' &&
      jwksUrl.hostname !== 'localhost' &&
      jwksUrl.hostname !== '127.0.0.1'
    ) {
      throw new Error(
        `JWKS URI must use HTTPS protocol: ${issuerMetadata.jwks_uri}`
      );
    }
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

  return {
    success,
    verifiedEmail,
    ...(errorMsg ? {error: errorMsg} : {}),
    steps,
  };
}
