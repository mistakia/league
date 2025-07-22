import express from 'express'
import swaggerUi from 'swagger-ui-express'
import specs from '../swagger/config.mjs'

const router = express.Router()

/**
 * Swagger UI configuration options for the API documentation interface
 * @constant {Object} swaggerOptions
 * @property {boolean} explorer - Enable API explorer functionality
 * @property {string} customCss - Custom CSS styling for the documentation interface
 * @property {string} customSiteTitle - Custom title for the documentation page
 * @property {string} customfavIcon - Custom favicon for the documentation page
 */
const swaggerOptions = {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #1976d2; }
  `,
  customSiteTitle: 'xo.football API Documentation',
  customfavIcon: '/static/favicon.ico'
}

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Serve API documentation interface
 *     description: |
 *       Provides an interactive Swagger UI interface for exploring and testing the xo.football League API.
 *       The documentation includes all available endpoints with request/response schemas, examples, and testing capabilities.
 *
 *       **Note**: This API is currently in active development and is not yet stable. Breaking changes are expected.
 *     tags:
 *       - Documentation
 *     responses:
 *       '200':
 *         description: API documentation interface
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML page containing the Swagger UI interface
 *             examples:
 *               swagger-ui:
 *                 summary: Interactive API documentation
 *                 description: A fully interactive Swagger UI interface with all API endpoints
 *       '404':
 *         $ref: '#/components/responses/BadRequestError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *     x-code-samples:
 *       - lang: 'JavaScript'
 *         source: |
 *           // Access the documentation in your browser
 *           window.location.href = '/api/docs';
 *       - lang: 'curl'
 *         source: |
 *           # Open the API documentation
 *           curl -X GET "http://localhost:3000/api/docs"
 */

// Mount Swagger UI middleware
router.use('/', swaggerUi.serve)

/**
 * GET /docs
 * Serves the Swagger UI documentation interface
 *
 * This endpoint provides an interactive API documentation interface using Swagger UI.
 * The interface allows users to explore all available endpoints, view request/response schemas,
 * and test API calls directly from the browser.
 *
 * Features:
 * - Interactive API explorer with request/response examples
 * - Authentication testing capabilities
 * - Schema validation and documentation
 * - Custom styling matching the xo.football branding
 * - Comprehensive endpoint coverage with parameter descriptions
 *
 * @route GET /docs
 * @group Documentation - API documentation interface
 * @returns {HTML} 200 - Interactive Swagger UI documentation interface
 * @returns {Error} 404 - Documentation not found
 * @returns {Error} 500 - Internal server error
 */
router.get('/', swaggerUi.setup(specs, swaggerOptions))

export default router
