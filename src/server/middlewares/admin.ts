/*
 * @license
 * Copyright 2023 Google Inc. All rights reserved.
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
import {Users} from '~project-sesame/server/libs/users.ts';
import {logger} from '~project-sesame/server/libs/logger.ts';

const router = Router();

// TODO(security): Gate with admin ACL. Anyone can trigger the eviction for
// now. It only deletes expired accounts and orphaned data, but the orphan
// sweep reads every passkey, signed-in session and federation mapping, so
// repeated calls can inflate Firestore usage. Restricting this to a scheduler
// (e.g. App Engine Cron, whose `X-Appengine-Cron` header can't be forged by
// external requests) is left for a follow-up, as it depends on how the
// eviction gets scheduled.

/**
 * Evicts expired accounts along with all of their associated data, and
 * deletes data that outlived its account.
 */
router.get(
  '/delete-all-users',
  async (req: Request, res: Response): Promise<void> => {
    try {
      await Users.deleteOldUsers();
    } catch (error) {
      // Keep the details in the server log. Running the eviction again picks up
      // where it failed.
      logger.error('Failed to evict expired accounts.', error);
      res.status(500).json({error: 'Failed to evict expired accounts.'});
      return;
    }
    res.sendStatus(200);
  }
);

export {router as admin};
