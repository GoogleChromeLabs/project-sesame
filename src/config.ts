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
  title: string
  repository_url: string
  id_token_lifetime: number
}

if (process.env.NODE_ENV === 'localhost') {
  process.env.DOMAIN = 'http://localhost:8080';
  process.env.FIRESTORE_EMULATOR_HOST = `${firebaseJson.emulators.firestore.host}:${firebaseJson.emulators.firestore.port}`;
}

initializeApp();
export const store = getFirestore(process.env.FIRESTORE_DATABASENAME || '');
store.settings({ ignoreUndefinedProperties: true });

export const vars: AppConfig = {
  title: '',
  repository_url: '',
  id_token_lifetime: 0
};

export function initialize(app: Express) {
  vars.title = process.env.PROJECT_NAME;
  vars.repository_url = npm_package.repository.url;
  vars.id_token_lifetime = process.env.ID_TOKEN_LIFETIME || 1 * 24 * 60 * 60 * 1000;
};
