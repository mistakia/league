import path from 'path'
import { fileURLToPath } from 'url'

import express from 'express'

import config from '#config'
import { create_logger } from '#libs-shared/log.mjs'
import { symbolicate_stack } from '#libs-server/symbolicate-stack.mjs'

const router = express.Router()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Where the build's *.js.map files live for server-side symbolication. In
// production these are rsynced to a PRIVATE path on the league host (never the
// public dist/); locally they default to the repo-root dist/ produced by
// `yarn build`. Resolution is best-effort — an unset/missing dir leaves stacks
// minified rather than failing the report.
const SOURCEMAP_DIR =
  config?.sourcemap_dir || path.join(__dirname, '..', '..', 'dist')

const HIGH_SEVERITY_ERROR_CLASSES = new Set([
  'TypeError',
  'ReferenceError',
  'RangeError',
  'SyntaxError',
  'EvalError'
])

const route_logger = create_logger('api:errors', { service: 'league-client' })

/**
 * @swagger
 * /errors:
 *   post:
 *     summary: Report client error
 *     description: |
 *       Report a client-side error to the server for logging and monitoring.
 *       This endpoint allows clients to report JavaScript errors, API failures, or other
 *       client-side issues to help with debugging and system monitoring.
 *
 *       The error report includes contextual information like league ID, team ID, user ID,
 *       and client details (IP address, user agent) to help administrators investigate issues.
 *
 *       The minified stack is symbolicated server-side against the build's private sourcemaps,
 *       then emitted as a `log_error` signal (service `league-client`) to the base signal queue.
 *     tags:
 *       - Error Reporting
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               leagueId:
 *                 type: integer
 *                 description: League ID where the error occurred (optional)
 *                 example: 2
 *               teamId:
 *                 type: integer
 *                 description: Team ID associated with the error (optional)
 *                 example: 13
 *               userId:
 *                 type: integer
 *                 description: User ID who encountered the error (optional)
 *                 example: 5
 *               error:
 *                 type: object
 *                 description: Error details object containing error information
 *                 properties:
 *                   message:
 *                     type: string
 *                     description: Error message
 *                     example: "TypeError: Cannot read property 'length' of undefined"
 *                   stack:
 *                     type: string
 *                     description: Error stack trace (optional)
 *                     example: "TypeError: Cannot read property 'length' of undefined\n    at PlayerList.render (PlayerList.js:45:12)"
 *                   name:
 *                     type: string
 *                     description: Error name/type (optional)
 *                     example: "TypeError"
 *                   filename:
 *                     type: string
 *                     description: File where error occurred (optional)
 *                     example: "PlayerList.js"
 *                   lineno:
 *                     type: integer
 *                     description: Line number where error occurred (optional)
 *                     example: 45
 *                   colno:
 *                     type: integer
 *                     description: Column number where error occurred (optional)
 *                     example: 12
 *                 required:
 *                   - message
 *                 example:
 *                   message: "TypeError: Cannot read property 'length' of undefined"
 *                   stack: "TypeError: Cannot read property 'length' of undefined\n    at PlayerList.render (PlayerList.js:45:12)"
 *                   name: "TypeError"
 *                   filename: "PlayerList.js"
 *                   lineno: 45
 *                   colno: 12
 *               metadata:
 *                 type: object
 *                 description: >-
 *                   Optional client context preserved in the signal payload — the capture surface
 *                   (`handler`: window.onerror / unhandledrejection), React `componentStack`, request
 *                   options, data-view field info, and user identity.
 *                 example:
 *                   handler: "window.onerror"
 *                   componentStack: "\n    at PlayerList\n    at App"
 *             required:
 *               - error
 *             example:
 *               leagueId: 2
 *               teamId: 13
 *               userId: 5
 *               error:
 *                 message: "TypeError: Cannot read property 'length' of undefined"
 *                 stack: "TypeError: Cannot read property 'length' of undefined\n    at PlayerList.render (PlayerList.js:45:12)"
 *                 name: "TypeError"
 *                 filename: "PlayerList.js"
 *                 lineno: 45
 *                 colno: 12
 *     responses:
 *       200:
 *         description: Error report successfully logged and admin notified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indicates successful error reporting
 *                   example: true
 *               required:
 *                 - success
 *             example:
 *               success: true
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *     x-code-samples:
 *       - lang: 'JavaScript'
 *         label: 'Report JavaScript Error'
 *         source: |
 *           // Report a JavaScript error from client-side code
 *           try {
 *             // Some operation that might fail
 *             const result = someArray.length;
 *           } catch (error) {
 *             fetch('/api/errors', {
 *               method: 'POST',
 *               headers: {
 *                 'Content-Type': 'application/json'
 *               },
 *               body: JSON.stringify({
 *                 leagueId: 2,
 *                 teamId: 13,
 *                 userId: 5,
 *                 error: {
 *                   message: error.message,
 *                   stack: error.stack,
 *                   name: error.name,
 *                   filename: error.filename,
 *                   lineno: error.lineno,
 *                   colno: error.colno
 *                 }
 *               })
 *             });
 *           }
 *       - lang: 'JavaScript'
 *         label: 'Report API Error'
 *         source: |
 *           // Report an API error from client-side code
 *           fetch('/api/players')
 *             .then(response => {
 *               if (!response.ok) {
 *                 throw new Error(`HTTP ${response.status}: ${response.statusText}`);
 *               }
 *               return response.json();
 *             })
 *             .catch(error => {
 *               fetch('/api/errors', {
 *                 method: 'POST',
 *                 headers: {
 *                   'Content-Type': 'application/json'
 *                 },
 *                 body: JSON.stringify({
 *                   leagueId: getCurrentLeagueId(),
 *                   teamId: getCurrentTeamId(),
 *                   userId: getCurrentUserId(),
 *                   error: {
 *                     message: `API Error: ${error.message}`,
 *                     stack: error.stack,
 *                     name: 'APIError'
 *                   }
 *                 })
 *               });
 *             });
 *       - lang: 'curl'
 *         label: 'cURL Example'
 *         source: |
 *           curl -X POST /api/errors \
 *             -H "Content-Type: application/json" \
 *             -d '{
 *               "leagueId": 2,
 *               "teamId": 13,
 *               "userId": 5,
 *               "error": {
 *                 "message": "TypeError: Cannot read property length of undefined",
 *                 "stack": "TypeError: Cannot read property length of undefined\n    at PlayerList.render (PlayerList.js:45:12)",
 *                 "name": "TypeError",
 *                 "filename": "PlayerList.js",
 *                 "lineno": 45,
 *                 "colno": 12
 *               }
 *             }'
 */
router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { leagueId, teamId, userId, error, metadata } = req.body
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    const user_agent = req.headers['user-agent']
    logger({ leagueId, teamId, userId, error, ip, userAgent: user_agent })

    const error_class = error?.name || 'Error'
    const severity = HIGH_SEVERITY_ERROR_CLASSES.has(error_class)
      ? 'high'
      : 'medium'
    const synthetic = new Error(error?.message || 'Unknown client error')
    synthetic.name = error_class
    if (error?.stack) {
      synthetic.stack = await symbolicate_stack(error.stack, {
        sourcemap_dir: SOURCEMAP_DIR
      })
    }
    route_logger.error(synthetic, {
      severity,
      context: {
        league_id: leagueId || null,
        team_id: teamId || null,
        user_id: userId || null,
        ip: ip || null,
        user_agent: user_agent || null,
        filename: error?.filename || null,
        lineno: error?.lineno ?? null,
        colno: error?.colno ?? null,
        // Client-supplied metadata (capture surface, component stack, request
        // options, field info, user) — previously only captured by Bugsnag.
        handler: metadata?.handler || null,
        component_stack: metadata?.componentStack || null,
        metadata: metadata || null
      }
    })

    res.send({ success: true })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
