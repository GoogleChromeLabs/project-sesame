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

import { Request, Response, NextFunction } from "express";

/**
 * Checks CSRF protection using custom header `X-Requested-With`
 **/
export function csrfCheck(req: Request, res: Response, next: NextFunction): any {
  if (req.header("X-Requested-With") != "XMLHttpRequest") {
    return res.status(400).json({ error: "invalid access." });
  }
  // TODO: If the path starts with `fedcm` also check `Sec-Fetch-Dest: webidentity`.
  return next();
}

export function getTime(offset: number = 0): number {
  return (new Date()).getTime() + offset;
}
