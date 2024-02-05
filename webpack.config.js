/*
 * @license
 * Copyright 2023 Google Inc. All rights reserved.
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

import * as sass from 'sass';
import CopyPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import url from 'url';
import path from 'path';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));  

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

const entries = {
  'components': path.join(srcDir, 'static', 'scripts', 'components.js'),
  'styles': path.join(srcDir, 'static', 'styles', 'style.scss'),
}

export default {
  entry: entries,
  mode: 'production',
  output: {
    filename: path.join('static', 'scripts', '[name].js'),
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: path.join('static', 'styles', 'styles.css'),
            },
          },
          { loader: 'extract-loader' },
          { loader: 'css-loader' },
          {
            loader: 'sass-loader',
            options: {
              implementation: sass,
              webpackImporter: false,
              sassOptions: {
                includePaths: [ path.join(__dirname, 'node_modules') ],
              },
            },
          },
        ],
      },
      {
        test: /components\.js$/,
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [{
        from: srcDir,
        to: distDir,
        filter: async (path) => {
          // If built file is included, skip copying.
          for (let value of Object.values(entries)) {
            if (path.includes(value)) return false;
          }
          return true;
        },
      }],
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      })
    ],
  },
};
