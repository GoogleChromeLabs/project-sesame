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
  apis: ['./src/server/middlewares/*.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
