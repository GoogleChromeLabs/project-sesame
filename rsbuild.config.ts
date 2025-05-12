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

import fs from 'node:fs';
import path from 'node:path';
import {defineConfig} from '@rsbuild/core';
import {pluginSass} from '@rsbuild/plugin-sass';

/** Configuration for [rsbuild](https://rsbuild.dev/), building
 * the frontend of Project Sesame and also copying shared files
 * to the dist folder to have them available for the backend.
 */

/**
 * Create `entry` object to pass to the `defineConfig` function below, that maps
 * all the paths under `/src/client/pages` by traversing the file system so that
 * they don't have to be manually added. The path should include `./` at the
 * beginning.
 */
function createEntryPoints(dir: string): Record<string, string> {
  const entryPoints: Record<string, string> = {};

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      // Recursively get entries from the subdirectory
      const nestedEntries = createEntryPoints(fullPath);
      const dirName = path.basename(file); // Get the name of the current directory, e.g., "settings"
      for (const nestedKey in nestedEntries) {
        // Construct the new key by prepending the current directory's name.
        // Ensure forward slashes for cross-platform consistency in keys.
        const newKey = (dirName + '/' + nestedKey).replace(/\\/g, '/');
        entryPoints[newKey] = nestedEntries[nestedKey]; // Value is already correctly formatted from deeper call
      }
    } else if (stats.isFile() && path.extname(file) === '.ts') {
      const name = path.basename(file, '.ts');
      // Ensure the path value is prefixed with './' and uses forward slashes.
      entryPoints[name] = './' + fullPath.split(path.sep).join('/');
    }
  }
  return entryPoints;
}

const entry = createEntryPoints('./src/client/pages');

export default defineConfig({
  plugins: [pluginSass()],
  source: {
    tsconfigPath: './src/client/tsconfig.json',
    entry,
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
    polyfill: 'off',
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
