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
import {SessionService, ApiType, apiAclCheck} from '../libs/session.ts';
import {verifyEvpToken, VerifyEvpTokenResult} from '../libs/evp.ts';
import {Users, generatePasskeyUserId} from '../libs/users.ts';
import {logger} from '../libs/logger.ts';
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
 * Verifies the Email Verification Token (EVT) in the request body against the
 * challenge bound to the session.
 *
 * The challenge is consumed before the token is verified, whatever the
 * outcome, so that a single challenge can't be replayed across verification
 * attempts.
 *
 * @param req - The Express request, with `email` and `evt` in its body.
 * @param res - The Express response. It receives HTTP 400 when the request is
 *     missing parameters or the session has no challenge.
 * @returns The verification result, or `undefined` if a response has already
 *     been sent.
 */
async function verifyRequestToken(
  req: Request,
  res: Response
): Promise<VerifyEvpTokenResult | undefined> {
  const {email, evt} = req.body;

  if (!email || !evt) {
    res.status(400).json({error: 'Missing email or token (evt)'});
    return undefined;
  }

  const sessionService = new SessionService(req.session);
  const expectedNonce = sessionService.getChallenge();

  if (!expectedNonce) {
    res.status(400).json({
      error: 'No active verification challenge found in session.',
    });
    return undefined;
  }

  sessionService.deleteChallenge();

  const rawProto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const protocol = rawProto.split(',')[0].trim();
  const rawHost =
    (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
  const host = rawHost.split(',')[0].trim();
  const expectedAudience = `${protocol}://${host}`;

  return verifyEvpToken({
    email,
    evt,
    expectedAudience,
    expectedNonce,
  });
}

/**
 * Verify the EVP email verification token
 */
router.post(
  '/verify',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response): Promise<void> => {
    const result = await verifyRequestToken(req, res);
    if (result) {
      res.json(result);
    }
  }
);

/**
 * Verifies the EVP email verification token and, on success, starts a
 * passwordless sign-up for the verified address (`/evp-passkey-signup`). The
 * client then moves on to passkey creation at `/new-passkey`.
 */
router.post(
  '/signup',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response): Promise<void> => {
    const result = await verifyRequestToken(req, res);
    if (!result) {
      return;
    }
    if (!result.success) {
      res.json(result);
      return;
    }

    try {
      // Email ownership is proven. Start the passwordless sign-up so the
      // client can move on to passkey creation.
      const verifiedEmail = await startPasskeySignUp(
        req.session,
        result.verifiedEmail
      );
      res.json({...result, verifiedEmail});
    } catch (error: any) {
      logger.error('Passwordless sign-up error:', error);
      res.json({
        ...result,
        success: false,
        verifiedEmail: '',
        error: error.message || 'Sign-up failed.',
      });
    }
  }
);

/**
 * Starts the one-time code fallback when the browser didn't supply an Email
 * Verification Token. The claimed address is kept in the session as pending
 * so that the `/one-time-code` page and `POST /email/otp` can verify it
 * without trusting the client to send it again.
 *
 * SIMULATED: this demo doesn't send any email. A real implementation must
 * generate a random code here, deliver it to the address, and store it with a
 * short expiry.
 */
router.post(
  '/otp/request',
  apiAclCheck(ApiType.NoAuth),
  (req: Request, res: Response): void => {
    const {email} = req.body;
    const sessionService = new SessionService(req.session);

    // Require the challenge set by the sign-up page so that this endpoint is
    // only reachable from a freshly loaded page in the same session.
    if (!sessionService.getChallenge()) {
      res.status(400).json({
        error: 'No sign-up in progress. Reload the page and try again.',
      });
      return;
    }

    const normalized =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!isPlausibleEmail(normalized) || !Users.isValidUsername(normalized)) {
      res.status(400).json({error: 'Enter a valid email address.'});
      return;
    }

    sessionService.setPendingEmail(normalized);
    res.json({success: true});
  }
);

/**
 * Verifies the one-time code for the pending email address, then starts a
 * passwordless sign-up.
 *
 * SIMULATED: this demo doesn't send any email, so any 6-digit code is
 * accepted. A real implementation must compare the code with the one stored
 * by `POST /email/otp/request`, honor its expiry, and rate-limit attempts.
 */
router.post(
  '/otp',
  apiAclCheck(ApiType.NoAuth),
  async (req: Request, res: Response): Promise<void> => {
    const {otp} = req.body;
    const sessionService = new SessionService(req.session);

    // Verify only the address stored by `POST /email/otp/request`. Never take
    // it from the request body.
    const email = sessionService.getPendingEmail();
    if (!email) {
      res.status(400).json({
        error: 'No email address is waiting for verification. Start over.',
      });
      return;
    }

    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      res.status(400).json({error: 'Enter the 6-digit code.'});
      return;
    }

    try {
      const verifiedEmail = await startPasskeySignUp(req.session, email);
      // The EVP nonce is no longer needed once the address is verified.
      sessionService.deleteChallenge();
      res.json({success: true, verifiedEmail});
    } catch (error: any) {
      logger.error('OTP fallback error:', error);
      res.status(400).json({error: error.message || 'Verification failed.'});
    }
  }
);

export {router as email};
