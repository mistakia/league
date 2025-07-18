import express from 'express'

import config from '#config'
import { sendEmail } from '#libs-server'

const router = express.Router()

/**
 * @swagger
 * /errors:
 *   post:
 *     summary: Report client error
 *     description: |
 *       Report a client-side error to the server for logging and admin notification.
 *       This endpoint allows clients to report JavaScript errors, API failures, or other
 *       client-side issues to help with debugging and system monitoring.
 *
 *       The error report includes contextual information like league ID, team ID, user ID,
 *       and client details (IP address, user agent) to help administrators investigate issues.
 *
 *       An email notification is sent to the admin email address configured in the system.
 *     tags:
 *       - System
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
    const { leagueId, teamId, userId, error } = req.body
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    const userAgent = req.headers['user-agent']
    const message = { leagueId, teamId, userId, error, ip, userAgent }
    logger(message)
    await sendEmail({
      to: config.email.admin,
      subject: `client error: ${error.message}`,
      message: JSON.stringify(message, null, 2)
    })
    res.send({ success: true })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
