/*
 * @license
 * Copyright 2026 Google Inc. All rights reserved.
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

import {defineConfig} from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.test.ts'],
    reporters: process.env.GITHUB_ACTIONS
      ? ['default', 'github-actions', 'junit']
      : ['default'],
    outputFile: {
      junit: './junit.xml',
    },
    alias: {
      '~project-sesame/client': path.resolve('src/client'),
      '~project-sesame/server': path.resolve('src/server'),
      '~project-sesame/shared': path.resolve('src/shared'),
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types.d.ts',
        'src/client/helpers/analytics.ts', // Exclude pure third-party integration if needed, or keep all
      ],
      thresholds: {
        statements: 10,
        branches: 10,
        functions: 18,
        lines: 10,
      },
    },
  },
});
