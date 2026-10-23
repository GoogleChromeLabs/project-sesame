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
import {SessionService, ApiType, apiAclCheck} from '../libs/session.ts';
import {verifyEvpToken} from '../libs/evp.ts';
import {csrfCheck} from './common.ts';

const router = Router();

router.use(csrfCheck);

/**
 * Verify the EVP email verification token
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

    const sessionService = new SessionService(req.session);
    const expectedNonce = sessionService.getChallenge();

    if (!expectedNonce) {
      res.status(400).json({
        error: 'No active verification challenge found in session.',
      });
      return;
    }

    sessionService.deleteChallenge();

    const rawProto =
      (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const protocol = rawProto.split(',')[0].trim();
    const rawHost =
      (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
    const host = rawHost.split(',')[0].trim();
    const expectedAudience = `${protocol}://${host}`;

    const result = await verifyEvpToken({
      email,
      evt,
      expectedAudience,
      expectedNonce,
    });

    res.json(result);
  }
);

export {router as email};
