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

import {Request, Response, NextFunction} from 'express';

/**
 * Checks CSRF protection using custom header `X-Requested-With`
 **/
export function csrfCheck(
  req: Request,
  res: Response,
  next: NextFunction
): any {
  const xhr = req.header('X-Requested-With');
  if (!xhr || xhr !== 'XMLHttpRequest') {
    return res.status(400).json({error: 'Invalid XHR request.'});
  }
  return next();
}

/**
 * Checks CSRF protection using custom header `Sec-Fetch-Dest`
 **/
export function fedcmCheck(
  req: Request,
  res: Response,
  next: NextFunction
): any {
  const dest = req.header('Sec-Fetch-Dest');
  if (!dest || dest !== 'webidentity') {
    return res.status(400).json({error: 'Invalid FedCM request.'});
  }
  return next();
}

export function getTime(offset = 0): number {
  return new Date().getTime() + offset;
}

export const FOREVER: number = 1000 * 60 * 60 * 24 * 400;
