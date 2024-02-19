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

import npm_package from '../package.json' with { type: 'json' };
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import dotenv from 'dotenv';
export const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import { Express } from 'express';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseJson from '../firebase.json' with { type: 'json' };

interface AppConfig {
  debug: boolean;
  is_localhost: boolean;
  origin: string;
  port: number;
  hostname: string;
  title: string;
  repository_url: string;
  id_token_lifetime: number;
  short_session_duration: number;
  long_session_duration: number;
}

const is_localhost = process.env.NODE_ENV === 'localhost' || !process.env.NODE_ENV;

if (is_localhost) {
  process.env.FIRESTORE_EMULATOR_HOST = `${firebaseJson.emulators.firestore.host}:${firebaseJson.emulators.firestore.port}`;
}

initializeApp();
export const store = getFirestore(process.env.FIRESTORE_DATABASENAME || '');
store.settings({ ignoreUndefinedProperties: true });

export const config: AppConfig = {
  debug: false,
  is_localhost,
  origin: '',
  port: process.env.PORT || 8080,
  hostname: '',
  title: '',
  repository_url: '',
  id_token_lifetime: 0,
  short_session_duration: 0,
  long_session_duration: 0,
};

export function configureApp(app: Express) {
  if (!config.is_localhost && !process.env.ORIGIN) {
    throw new Error('Environment variable `ORIGIN` is not set.');
  }
  config.origin = is_localhost ? `http://localhost:${config.port}` : process.env.ORIGIN;
  config.hostname = (new URL(config.origin)).hostname;
  config.title = process.env.PROJECT_NAME;
  config.repository_url = npm_package.repository.url;
  config.id_token_lifetime = process.env.ID_TOKEN_LIFETIME || 1 * 24 * 60 * 60 * 1000;
  config.short_session_duration = process.env.SHORT_SESSION_DURATION || 3 * 60 * 1000;
  config.long_session_duration = process.env.LONG_SESSION_DURATION || 1000 * 60 * 60 * 24 * 365;
  if (config.is_localhost || process.env.NODE_ENV === 'development') {
    config.debug = true;
  }
};
