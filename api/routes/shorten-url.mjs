import express from 'express'
import { blake2b } from 'blakejs'

import { validators } from '#libs-server'
import db from '#db'

const router = express.Router()

const get_url_hash = (url) => {
  const hash = Array.from(blake2b(url, null, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hash
}

/**
 * @swagger
 * /u:
 *   servers:
 *     - url: ''
 *       description: Root path
 *   post:
 *     tags:
 *       - Utilities
 *     summary: Create a shortened URL
 *     description: Create a shortened URL for xo.football or localhost domains. The service generates a unique hash for each URL and stores it for later retrieval.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: The URL to shorten (must be from xo.football or localhost)
 *                 example: "https://xo.football/leagues/2/players"
 *             required:
 *               - url
 *           examples:
 *             shorten_request:
 *               summary: Shorten a URL
 *               value:
 *                 url: "https://xo.football/leagues/2/players"
 *     responses:
 *       200:
 *         description: Successfully created shortened URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 short_url:
 *                   type: string
 *                   description: The shortened URL path
 *                   example: "/u/a1b2c3d4e5f6g7h8"
 *                 url:
 *                   type: string
 *                   description: The original URL
 *                   example: "https://xo.football/leagues/2/players"
 *                 url_hash:
 *                   type: string
 *                   description: The generated hash for the URL
 *                   example: "a1b2c3d4e5f6g7h8"
 *             examples:
 *               shorten_response:
 *                 summary: Shortened URL response
 *                 value:
 *                   short_url: "/u/a1b2c3d4e5f6g7h8"
 *                   url: "https://xo.football/leagues/2/players"
 *                   url_hash: "a1b2c3d4e5f6g7h8"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *         examples:
 *           invalid_url:
 *             summary: Invalid URL format
 *             value:
 *               error: "Invalid URL"
 *           invalid_domain:
 *             summary: Invalid domain
 *             value:
 *               error: "Invalid domain"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { url } = req.body
    const validation_result = validators.short_url_validator(url)
    if (validation_result !== true) {
      return res.status(400).json({ error: 'Invalid URL' })
    }

    const valid_domains = ['xo.football', 'localhost']
    const url_object = new URL(url)
    if (!valid_domains.includes(url_object.hostname)) {
      return res.status(400).json({ error: 'Invalid domain' })
    }

    const url_hash = get_url_hash(url)
    await db('urls').insert({ url, url_hash }).onConflict('url').ignore()
    const short_url = `/u/${url_hash}`
    res.json({ short_url, url, url_hash })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

/**
 * @swagger
 * /u/{hash}:
 *   servers:
 *     - url: ''
 *       description: Root path (for shortened URLs)
 *   get:
 *     tags:
 *       - Utilities
 *     summary: Redirect to original URL
 *     description: Redirect to the original URL using the shortened URL hash. If the hash is found, the user is redirected to the original URL.
 *     parameters:
 *       - name: hash
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The hash from the shortened URL
 *         example: "a1b2c3d4e5f6g7h8"
 *     responses:
 *       302:
 *         description: Redirect to original URL
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               format: uri
 *             description: The original URL to redirect to
 *             example: "https://xo.football/leagues/2/players"
 *       404:
 *         description: Shortened URL not found
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "Cannot GET /u/invalidhash"
 */
router.get('/:hash', async (req, res) => {
  const { hash } = req.params
  const url = await db('urls').where('url_hash', hash).first()
  if (url) {
    res.redirect(url.url)
  }
})

export default router
