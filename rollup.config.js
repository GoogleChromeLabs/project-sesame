/**
 * Copyright 2024 Google LLC
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
 * limitations under the License.
 */

import * as glob from 'glob';
import path from 'path';
import url from 'url';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
// import terser from '@rollup/plugin-terser';
// import json from '@rollup/plugin-json';
// import builtins from 'rollup-plugin-node-builtins';
// import globals from 'rollup-plugin-node-globals';
import copy from 'rollup-plugin-copy';
import scss from 'rollup-plugin-scss';
import css from 'rollup-plugin-import-css';
import sourcemaps from 'rollup-plugin-sourcemaps';
import * as fs from 'fs';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const serverSrc = path.join(__dirname, 'src');
const clientSrc = path.join(__dirname, 'src', 'static');
const dstRoot = path.join(__dirname, 'dist');
const clientDst = path.join(dstRoot, 'static');

export default () => {
  const sourcemap = process.env.NODE_ENV !== 'production' ? true : false;
  if (!fs.existsSync(path.join(serverSrc, '.env'))) {
    throw new Error('.env file does not exist under /src.');
    process.exit();
  }

  const plugins = [
    typescript({
      tsconfig: path.join(clientSrc, 'tsconfig.json'),
    }),
    commonjs({ extensions: ['.js', '.ts', '.mts'] }),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
      cache: true,
    }),
    // terser({
    //   module: true,
    //   treeshake: true,
    // }),
    // builtins(),
    // globals(),
    // json(),
    sourcemaps(),
  ];

  const config = glob.sync(path.join(clientSrc, '**', '*.ts')).map((src) => {
    let external;
    if (src.includes('fedcm-rp')) {
      external = 'https://fedcm-idp-demo.glitch.me/fedcm.js';
    }
    return {
      input: src,
      output: {
        file: path.join(dstRoot, `${src.replace(/^.*\/src\/|\.ts/g, '')}.js`),
        format: 'es',
        sourcemap,
      },
      external,
      plugins,
    };
  });

  return [
  ...config,
  {
    input: path.join(clientSrc, 'fedcm.js'),
    output: {
      file: path.join(clientDst, 'fedcm.js'),
      format: 'es',
    },
    plugins: [
      ...plugins,
      copy({
        targets: [{
          src: path.join(clientSrc, 'images', '*'),
          dest: path.join(clientDst, 'images'),
        }, {
          src: path.join(serverSrc, 'views', '*'),
          dest: path.join(dstRoot, 'views'),
        }, {
          src: path.join(serverSrc, '.env'),
          dest: dstRoot
        }]
      }),
    ]
  },
  {
    input: path.join(clientSrc, 'styles', 'style.scss'),
    output: {
      file: path.join(clientDst, 'styles', 'style.js'),
      format: 'esm',
      assetFileNames: '[name][extname]',
    },
    plugins: [
      scss({
        include: [
          path.join(clientSrc, 'styles', '*.css'),
          path.join(clientSrc, 'styles', '*.scss'),
          './node_modules/**/*.*'
        ],
        name: 'style.css',
        outputStyle: 'compressed',
      }),
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      css(),
    ]
  }];
};
