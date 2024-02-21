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

import url from 'url';
import path from 'path';
import crypto from 'crypto';

import dotenv from 'dotenv';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import packageConfig from '../../package.json' with { type: 'json' };
import firebaseConfig from '../../firebase.json' with { type: 'json' };

const isLocalhost = process.env.NODE_ENV === 'localhost' || !process.env.NODE_ENV;

/**
 * During development, the server application only receives requests proxied
 * from the frontend tooling (e.g. Vite). This is because the frontend tooling
 * is responsible for serving the frontend application during development, to
 * enable hot module reloading and other development features.
 */
const isDevelopmentProxy = process.env.PROXY;

const projectRootFilePath = path.join(url.fileURLToPath(import.meta.url), '../../..');
const distRootFilePath = path.join(projectRootFilePath, 'dist');

console.log('Reading config from', path.join(projectRootFilePath, '/.env'));
dotenv.config({ path: path.join(projectRootFilePath, '/.env') });

/**
 * Pulls together various configurations and returns the configured
 * Firestore instance.
 * @returns {Firestore}
 */
function initializeFirestore() {
  if (isLocalhost) {
    process.env.FIRESTORE_EMULATOR_HOST = `${firebaseConfig.emulators.firestore.host}:${firebaseConfig.emulators.firestore.port}`;
  }

  initializeApp();

  const store = getFirestore(process.env.FIRESTORE_DATABASENAME || '');
  store.settings({ ignoreUndefinedProperties: true });
  return store;
}

export const store = initializeFirestore();

function configureApp() {
  const origin = process.env.ORIGIN || '';
  if (!origin) {
    throw new Error('Environment variable `ORIGIN` is not set.');
  }
  
  return {
    debug: isLocalhost || process.env.NODE_ENV === 'development',
    projectRootFilePath,
    distRootFilePath,
    viewsRootFilePath: path.join(distRootFilePath, 'shared/views'),
    isLocalhost,
    port: isDevelopmentProxy ? 8888 : process.env.PORT || 8080,
    origin,
    secret: process.env.SECRET || crypto.randomBytes(32).toString('hex'),
    hostname: (new URL(origin)).hostname,
    title: process.env.PROJECT_NAME,
    repository_url: packageConfig.repository?.url,
    id_token_lifetime: parseInt(process.env.ID_TOKEN_LIFETIME || `${1 * 24 * 60 * 60 * 1000}`),
    short_session_duration: parseInt(process.env.SHORT_SESSION_DURATION || `${3 * 60 * 1000}`),
    long_session_duration: parseInt(process.env.LONG_SESSION_DURATION || `${1000 * 60 * 60 * 24 * 365}`),
  }
}

export const config = configureApp();
export default config;