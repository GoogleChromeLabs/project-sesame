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

import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

import packageConfig from '../../package.json';
import firebaseConfig from '../../firebase.json';

const is_localhost =
  process.env.NODE_ENV === 'localhost' || !process.env.NODE_ENV;

/**
 * During development, the server application only receives requests proxied
 * from the frontend tooling (e.g. Vite). This is because the frontend tooling
 * is responsible for serving the frontend application during development, to
 * enable hot module reloading and other development features.
 */
const is_development_proxy = process.env.PROXY;

const project_root_file_path = path.join(
  url.fileURLToPath(import.meta.url),
  '../../..'
);
const dist_root_file_path = path.join(project_root_file_path, 'dist');

console.log('Reading config from', path.join(project_root_file_path, '/.env'));
dotenv.config({path: path.join(project_root_file_path, '/.env')});

/**
 * Pulls together various configurations and returns the configured
 * Firestore instance.
 * @returns {Firestore}
 */
function initializeFirestore() {
  if (is_localhost) {
    process.env.FIRESTORE_EMULATOR_HOST = `${firebaseConfig.emulators.firestore.host}:${firebaseConfig.emulators.firestore.port}`;
  }

  initializeApp();

  const store = getFirestore(process.env.FIRESTORE_DATABASENAME || '');
  store.settings({ignoreUndefinedProperties: true});
  return store;
}

export const store = initializeFirestore();

function configureApp() {
  const origin = process.env.ORIGIN || `http://localhost:${process.env.PORT || 8080}`;

  return {
    project_name: process.env.PROJECT_NAME || 'sesame',
    debug: is_localhost || process.env.NODE_ENV === 'development',
    project_root_file_path,
    dist_root_file_path,
    views_root_file_path: path.join(dist_root_file_path, 'shared/views'),
    is_localhost,
    port: is_development_proxy ? 8080 : process.env.PORT || 8080,
    origin,
    secret: process.env.SECRET || crypto.randomBytes(32).toString('hex'),
    hostname: new URL(origin).hostname,
    title: process.env.PROJECT_NAME,
    repository_url: packageConfig.repository?.url,
    id_token_lifetime: parseInt(
      process.env.ID_TOKEN_LIFETIME || `${1 * 24 * 60 * 60 * 1000}`
    ),
    forever_cookie_duration: 1000 * 60 * 60 * 24 * 365,
    short_session_duration: parseInt(
      process.env.SHORT_SESSION_DURATION || `${3 * 60 * 1000}`
    ),
    long_session_duration: parseInt(
      process.env.LONG_SESSION_DURATION || `${1000 * 60 * 60 * 24 * 365}`
    ),
  };
}

export const config = configureApp();
export default config;
