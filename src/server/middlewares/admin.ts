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
import {Router, Request, Response, NextFunction} from 'express';
import {Users} from '~project-sesame/server/libs/users.ts';
import {logger} from '~project-sesame/server/libs/logger.ts';

const router = Router();

/**
 * Validates that requests come from the App Engine Cron service.
 *
 * In deployed App Engine environments (prod, staging, idp), requests sent by
 * App Engine Cron include the `X-Appengine-Cron: true` header. App Engine strips
 * this header from external requests, making it unforgeable.
 */
export function cronCheck(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isDeployed =
    process.env.NODE_ENV === 'prod' ||
    process.env.NODE_ENV === 'staging' ||
    process.env.NODE_ENV === 'idp';

  if (isDeployed && req.header('X-Appengine-Cron') !== 'true') {
    logger.warn('Blocked unauthorized request to admin cron endpoint.', {
      path: req.path,
      ip: req.ip,
    });
    res.status(403).json({error: 'Forbidden'});
    return;
  }
  next();
}

/**
 * Evicts expired accounts along with all of their associated data, and
 * deletes data that outlived its account.
 */
router.get(
  '/delete-all-users',
  cronCheck,
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
