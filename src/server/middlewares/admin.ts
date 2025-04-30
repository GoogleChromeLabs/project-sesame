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

const router = Router();

// TODO: Gate with admin ACL

router.get(
  '/delete-all-users',
  async (
    req: Request,
    res: Response
  ): Promise<Response<any, Record<string, any>>> => {
    await Users.deleteOldUsers();
    return res.sendStatus(200);
  }
);

export {router as admin};
