import express from 'express'
import { get_blake2b_hash } from '#libs-shared'
import resolve_short_url_chain from '#libs-shared/resolve-short-url-chain.mjs'

import { validators } from '#libs-server'
import db from '#db'

const router = express.Router()

const get_url_hash = (url) => {
  return get_blake2b_hash(url, 16)
}

const CANONICALIZE_ERROR_CODES = new Set([
  'inner_hash_not_found',
  'short_url_cycle',
  'short_url_max_depth_exceeded'
])

const canonicalize_short_url = async ({ url }) => {
  const url_object = await resolve_short_url_chain({
    initial_url: url,
    fetch_url_by_hash: async (inner_hash) => {
      const row = await db('urls').where('url_hash', inner_hash).first()
      if (!row) {
        throw new Error('inner_hash_not_found')
      }
      return row.url
    }
  })
  return url_object.toString()
}

/**
 * @swagger
 * /u:
 *   post:
 *     tags:
 *       - Utilities
 *     summary: Create a shortened URL
 *     description: Create a shortened URL for xo.football or localhost domains. The service generates a unique hash for each URL and stores it for later retrieval. The returned `short_url` is the user-visible path `/u/<hash>`; clients fetch the underlying URL via `GET /api/u/{hash}`.
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
 *           inner_hash_not_found:
 *             summary: Chained /u/<hash> URL whose inner hash is not stored
 *             value:
 *               error: "inner_hash_not_found"
 *           short_url_cycle:
 *             summary: Chained URL whose inner hashes cycle
 *             value:
 *               error: "short_url_cycle"
 *           short_url_max_depth_exceeded:
 *             summary: Chained URL exceeded the maximum chain depth
 *             value:
 *               error: "short_url_max_depth_exceeded"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { url: incoming_url } = req.body
    const validation_result = validators.short_url_validator(incoming_url)
    if (validation_result !== true) {
      return res.status(400).json({ error: 'Invalid URL' })
    }

    const valid_domains = ['xo.football', 'localhost']
    const incoming_url_object = new URL(incoming_url)
    if (!valid_domains.includes(incoming_url_object.hostname)) {
      return res.status(400).json({ error: 'Invalid domain' })
    }

    // Defense-in-depth: if the client submitted a chained /u/<hash>... URL,
    // resolve the chain and store/hash the canonical URL. Old/buggy clients
    // can no longer pollute the table with chains.
    const url = await canonicalize_short_url({ url: incoming_url })
    const url_hash = get_url_hash(url)
    await db('urls').insert({ url, url_hash }).onConflict('url_hash').ignore()
    const short_url = `/u/${url_hash}`
    res.json({ short_url, url, url_hash })
  } catch (error) {
    if (CANONICALIZE_ERROR_CODES.has(error.message)) {
      return res.status(400).json({ error: error.message })
    }
    logger.error(error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

/**
 * @swagger
 * /u/{hash}:
 *   get:
 *     tags:
 *       - Utilities
 *     summary: Resolve a shortened URL
 *     description: Returns the original URL for the given hash as a JSON body. The SPA route at `/u/:hash` consumes this endpoint and hydrates Redux state in-page; no HTTP redirect is issued, which avoids 431 (Request Header Fields Too Large) errors on large stored URLs.
 *     parameters:
 *       - name: hash
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The hash from the shortened URL
 *         example: "a1b2c3d4e5f6g7h8"
 *     responses:
 *       200:
 *         description: The resolved URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: The original URL stored for this hash
 *                   example: "https://xo.football/data-views?columns=%5B%5D"
 *                 url_hash:
 *                   type: string
 *                   description: The hash used to resolve the URL
 *                   example: "a1b2c3d4e5f6g7h8"
 *       404:
 *         description: No URL is stored for the given hash
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "not_found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:hash', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { hash } = req.params
    const row = await db('urls').where('url_hash', hash).first()
    if (!row) {
      return res.status(404).json({ error: 'not_found' })
    }
    res.json({ url: row.url, url_hash: hash })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

export default router
