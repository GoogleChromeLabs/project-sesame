/*
 * @license
 * Copyright 2025 Google Inc. All rights reserved.
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

import swaggerJsdoc from 'swagger-jsdoc';
import {config} from '~project-sesame/server/config.ts';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Project Sesame API',
      version: '1.0.0',
      description: 'API documentation for Project Sesame authentication and identity services.',
    },
    servers: [
      {
        url: config.origin,
        description: 'Current verified origin',
      },
    ],
  },
  apis: ['./src/server/middlewares/*.ts', './src/server/app.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
