import express from 'express'
import os from 'os'
import fs from 'fs-extra'
import path from 'path'

const router = express.Router()
const cache_path = path.join(os.homedir(), './cache')

/**
 * @swagger
 * /cache/{cache_key}:
 *   get:
 *     summary: Retrieve cached data
 *     description: |
 *       Retrieves cached data from the filesystem cache by cache key.
 *       The cache key can contain path separators to access nested cache entries.
 *       Returns null if the cache entry doesn't exist or is outside the allowed cache directory.
 *     tags:
 *       - Cache
 *     parameters:
 *       - name: cache_key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *           Cache key identifier. Can contain path separators (/) to access nested cache entries.
 *           Path traversal attempts (../) are sanitized for security.
 *         example: "player_stats/2024/week_4"
 *     responses:
 *       200:
 *         description: Cache entry retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                   description: The cache key that was requested
 *                   example: "player_stats/2024/week_4"
 *                 value:
 *                   oneOf:
 *                     - type: object
 *                       description: The cached data (can be any JSON object)
 *                     - type: array
 *                       description: The cached data (can be any JSON array)
 *                     - type: string
 *                       description: The cached data (can be any JSON value)
 *                     - type: number
 *                       description: The cached data (can be any JSON value)
 *                     - type: boolean
 *                       description: The cached data (can be any JSON value)
 *                     - type: "null"
 *                       description: Returned when cache entry doesn't exist
 *                   example: {
 *                     "players": [
 *                       {
 *                         "pid": "PATR-MAHO-2017-1995-09-17",
 *                         "name": "Patrick Mahomes",
 *                         "passing_yards": 285
 *                       }
 *                     ]
 *                   }
 *               required:
 *                 - key
 *                 - value
 *             examples:
 *               cache_hit:
 *                 summary: Cache hit with data
 *                 value:
 *                   key: "player_stats/2024/week_4"
 *                   value:
 *                     players:
 *                       - pid: "PATR-MAHO-2017-1995-09-17"
 *                         name: "Patrick Mahomes"
 *                         passing_yards: 285
 *               cache_miss:
 *                 summary: Cache miss (no data)
 *                 value:
 *                   key: "nonexistent_key"
 *                   value: null
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:cache_key(*)', async (req, res) => {
  const { logger } = req.app.locals
  const { cache_key } = req.params
  try {
    // Sanitize the cache_key by removing any '..' or '.' characters to prevent accessing files outside of the cache_path
    const sanitized_cache_key = cache_key.replace(/(\.\.\/|\.\/)/g, '')

    const full_path = path.join(cache_path, sanitized_cache_key)
    const path_exists = await fs.pathExists(full_path)

    // Check if the full_path is within the cache_path directory to prevent accessing files outside of it
    const relative_path = path.relative(cache_path, full_path)
    const is_subpath =
      !!relative_path &&
      !relative_path.startsWith('..') &&
      !path.isAbsolute(relative_path)

    if (path_exists && is_subpath) {
      const value = await fs.readJson(full_path)
      return res.status(200).send({ key: cache_key, value })
    }

    return res.status(200).send({ key: cache_key, value: null })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /cache/{cache_key}:
 *   post:
 *     summary: Store data in cache
 *     description: |
 *       Stores JSON data in the filesystem cache using the specified cache key.
 *       The cache key can contain path separators to create nested cache entries.
 *       Requires admin authentication (userId === 1).
 *     tags:
 *       - Cache
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: cache_key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *           Cache key identifier. Can contain path separators (/) to create nested cache entries.
 *           The directory structure will be created automatically if it doesn't exist.
 *         example: "player_stats/2024/week_4"
 *     requestBody:
 *       required: true
 *       description: JSON data to cache
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 description: Any JSON object to cache
 *               - type: array
 *                 description: Any JSON array to cache
 *               - type: string
 *                 description: Any JSON value to cache
 *               - type: number
 *                 description: Any JSON value to cache
 *               - type: boolean
 *                 description: Any JSON value to cache
 *           examples:
 *             player_stats:
 *               summary: Player statistics data
 *               value:
 *                 players:
 *                   - pid: "PATR-MAHO-2017-1995-09-17"
 *                     name: "Patrick Mahomes"
 *                     passing_yards: 285
 *                     touchdowns: 3
 *             simple_value:
 *               summary: Simple value
 *               value: 42
 *             array_data:
 *               summary: Array data
 *               value:
 *                 - "item1"
 *                 - "item2"
 *                 - "item3"
 *     responses:
 *       200:
 *         description: Data cached successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                   description: The cache key that was used
 *                   example: "player_stats/2024/week_4"
 *                 value:
 *                   oneOf:
 *                     - type: object
 *                       description: The cached data (echoed back)
 *                     - type: array
 *                       description: The cached data (echoed back)
 *                     - type: string
 *                       description: The cached data (echoed back)
 *                     - type: number
 *                       description: The cached data (echoed back)
 *                     - type: boolean
 *                       description: The cached data (echoed back)
 *                   example: {
 *                     "players": [
 *                       {
 *                         "pid": "PATR-MAHO-2017-1995-09-17",
 *                         "name": "Patrick Mahomes",
 *                         "passing_yards": 285
 *                       }
 *                     ]
 *                   }
 *               required:
 *                 - key
 *                 - value
 *             example:
 *               key: "player_stats/2024/week_4"
 *               value:
 *                 players:
 *                   - pid: "PATR-MAHO-2017-1995-09-17"
 *                     name: "Patrick Mahomes"
 *                     passing_yards: 285
 *       400:
 *         description: Bad request - invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "invalid body"
 *       401:
 *         description: Unauthorized - admin authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "invalid token"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:cache_key(*)', async (req, res) => {
  const { logger } = req.app.locals
  const { cache_key } = req.params
  const { body } = req
  try {
    if (!req.auth || req.auth.userId !== 1) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).send({ error: 'invalid body' })
    }

    const full_path = path.join(cache_path, cache_key)
    await fs.ensureFile(full_path)
    await fs.writeJson(full_path, body, { spaces: 2 })

    return res.status(200).send({ key: cache_key, value: body })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
