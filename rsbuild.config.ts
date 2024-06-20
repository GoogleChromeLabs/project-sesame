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

import { defineConfig } from '@rsbuild/core';
import { pluginSass } from '@rsbuild/plugin-sass';

/** Configuration for [rsbuild](https://rsbuild.dev/), building
 * the frontend of Project Sesame and also copying shared files
 * to the dist folder to have them available for the backend.
 */

export default defineConfig({
  plugins: [ pluginSass() ],
  source: {
    tsconfigPath: './src/client/tsconfig.json',
    entry: {
      index: './src/client/pages/index.ts',
      // This contains all pages from src/client/pages
      // this can be heavily cleaned up once the frontend code has
      // some more structure
      'fedcm-rp': './src/client/pages/fedcm-rp.ts',
      'home': './src/client/pages/home.ts',
      'identifier-first-form': './src/client/pages/identifier-first-form.ts',
      'passkey-one-button': './src/client/pages/passkey-one-button.ts',
      'passkey-reauth': './src/client/pages/passkey-reauth.ts',
      'unified-button': './src/client/pages/unified-button.ts',
      'password': './src/client/pages/password.ts',
      'signin-form': './src/client/pages/signin-form.ts',
      'signup-form': './src/client/pages/signup-form.ts',
      'settings/passkeys': './src/client/pages/settings/passkeys.ts',
      'settings/delete-account': './src/client/pages/settings/delete-account.ts',
    },
  },
  html: {
    template: './src/client/layout.html',
    title: '{{ title }} | Project Sesame',
  },
  output: {
    cleanDistPath: true,
    distPath: {
      root: './dist/client',
      html: '../shared/views/layouts',
    },
    copy: [
      {
        from: './.env',
        to: '../',
      },
      {
        from: './src/shared',
        to: '../shared',
      },
    ],
  },
  dev: {
    writeToDisk: true,
  },
  server: {
    printUrls: false,
    proxy: {
      '/': {
        target: 'http://localhost:8888',
        // Requests to /static or related to hot-updates
        // can be served directly by rsbuild's
        // DevServer and don't need to be proxied.
        bypass: function (req, res, proxyOptions) {
          if (req.url && req.url.includes('/static/')) {
            return req.url;
          }

          if (req.url && req.url.includes('.hot-update.json')) {
            return req.url;
          }
        },
      },
    },
  },
});
