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

import url from 'node:url';
import path from 'node:path';
import * as fs from 'node:fs/promises';

import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

import packageConfig from '../../package.json' with {type:'json'};
import firebaseConfig from '../../firebase.json' with {type:'json'};

const is_localhost =
  process.env.NODE_ENV !== 'development' &&
  process.env.NODE_ENV !== 'production';

/**
 * During development, the server application only receives requests proxied
 * from the frontend tooling (e.g. Vite). This is because the frontend tooling
 * is responsible for serving the frontend application during development, to
 * enable hot module reloading and other development features.
 */
const is_development_proxy = process.env.PROXY;

const project_root_file_path = path.join(
  url.fileURLToPath(import.meta.url), '..', '..', '..'
);
const dist_root_file_path = path.join(project_root_file_path, 'dist');

// console.log('Reading config from', path.join(project_root_file_path, '/.env'));
// dotenv.config({path: path.join(project_root_file_path, '/.env')});

function generateApkKeyHash(sha256hash: string): string {
  const hexString = sha256hash.replace(/:/g, '');

  // Convert hex string to byte array
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }

  // Encode byte array to base64url
  const base64url = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `android:apk-key-hash:${base64url}`;
}

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

// Load the environment specific config file.
const env = process.env.NODE_ENV || 'localhost';
try {
  await fs.access(path.join(project_root_file_path, `${env}.config.json`));
} catch (e) {
  throw new Error(`"${env}.config.json" not found.`);
}
const {
  hostname,
  port = is_localhost ? 8080 : 443,
  associated_domains = [],
  id_token_lifetime = 1 * 24 * 60 * 60 * 1000,
  forever_cookie_duration = 1000 * 60 * 60 * 24 * 365,
  short_session_duration = 3 * 60 * 1000,
  long_session_duration = 1000 * 60 * 60 * 24 * 365,
  secret = 'set your own secret in the config file',
  rp_name,
  project_name,
  origin_trials = [],
} = (await import(path.join(project_root_file_path, `${env}.config.json`), {with:{type: 'json'}})).default;

if (!project_name || !rp_name || !hostname) {
  throw new Error('Missing configuration.');
}

process.env.GOOGLE_CLOUD_PROJECT = project_name;

const domain = port !== 443 ? `${hostname}:${port}` : hostname;
const origin = is_localhost ? `http://${domain}` : `https://${domain}`;

const associated_origins = associated_domains.map((_domain: any) => {
  return generateApkKeyHash(_domain.sha256_cert_fingerprints);
});

associated_domains.push(origin);
associated_origins.push(origin);

export const store = initializeFirestore();

export const config = {
  project_name,
  debug: is_localhost,
  project_root_file_path,
  dist_root_file_path,
  views_root_file_path: path.join(dist_root_file_path, 'shared', 'views'),
  is_localhost,
  hostname,
  port,
  domain,
  origin,
  secret,
  title: project_name,
  associated_domains,
  associated_origins,
  repository_url: packageConfig.repository?.url,
  id_token_lifetime,
  forever_cookie_duration,
  short_session_duration,
  long_session_duration,
  origin_trials,
};
console.log(config);
