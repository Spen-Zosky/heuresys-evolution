/**
 * OpenAPI/Swagger Configuration
 * Auto-generates API documentation from JSDoc annotations in route files.
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Heuresys AI-Platform API',
      version: '1.0.0',
      description:
        'Enterprise HRMS API with multi-tenant isolation, ESCO/NACE taxonomies, AI multi-provider orchestration, and comprehensive HR management.',
      contact: {
        name: 'Heuresys',
        url: 'https://heuresys.com',
      },
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code: { type: 'string' },
              },
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                limit: { type: 'integer' },
                offset: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication and authorization' },
      { name: 'Employees', description: 'Employee management' },
      { name: 'Goals', description: 'Goal management and tracking' },
      { name: 'Performance', description: 'Performance reviews and calibration' },
      { name: 'Skills', description: 'ESCO skills taxonomy' },
      { name: 'ESCO', description: 'ESCO classification explorer' },
      { name: 'NACE', description: 'NACE economic classification' },
      { name: 'Courses', description: 'Learning and development' },
      { name: 'Dashboard', description: 'Dashboard statistics' },
      { name: 'Analytics', description: 'HR analytics and predictions' },
      { name: 'AI', description: 'AI chat, career coach, RAG' },
      { name: 'Marketplace', description: 'Plugin marketplace' },
      { name: 'Platform', description: 'Platform administration' },
    ],
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
