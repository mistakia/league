import express from 'express'

import {
  generate_api_key,
  EXPORT_DEFAULT_MAX_LIMIT
} from '#libs-server/data-views/export-api-keys.mjs'

const router = express.Router()

// Mounted behind the blanket auth guard in api/index.mjs, so req.auth is always
// present here. Every query is still scoped by user_id: the guard proves WHO the
// caller is, not that a given key is theirs.
const MAX_KEYS_PER_USER = 10
const MAX_KEY_NAME_LENGTH = 60

// The row a user is allowed to see about their own key. The hash is deliberately
// absent -- it is the verifier, and a settings page has no use for it.
const public_key_columns = [
  'api_key_id',
  'key_prefix',
  'name',
  'created_at',
  'last_used_at',
  'revoked_at'
]

/**
 * @swagger
 * /settings/api-keys:
 *   get:
 *     tags:
 *       - Settings
 *     summary: List the authenticated user's API keys
 *     description: |
 *       Returns the caller's API keys, revoked ones included, most recent first.
 *       The key itself is never returned — only the prefix shown at generation.
 *       `data_view_export_max_rows` is the caller's export row ceiling; null
 *       means no ceiling.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: API keys for the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_keys:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiKey'
 *                 data_view_export_max_rows:
 *                   type: integer
 *                   nullable: true
 *                   description: Export row ceiling; null means no ceiling
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const user_id = req.auth.userId

    const api_keys = await db('user_api_keys')
      .select(public_key_columns)
      .where({ user_id })
      .orderBy('created_at', 'desc')

    const user = await db('users')
      .select('data_view_export_max_rows')
      .where({ id: user_id })
      .first()

    res.send({
      api_keys,
      data_view_export_max_rows: user
        ? user.data_view_export_max_rows
        : EXPORT_DEFAULT_MAX_LIMIT
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /settings/api-keys:
 *   post:
 *     tags:
 *       - Settings
 *     summary: Generate an API key
 *     description: |
 *       Mints a key for the authenticated user. The plaintext is returned ONCE,
 *       in this response, and is unrecoverable afterwards — only its SHA-256 is
 *       stored. Generating a key never changes the caller's export row ceiling,
 *       which is admin-owned.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: The generated key, in plaintext, for the only time
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiKey'
 *                 - type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                       description: The plaintext key, returned only here
 *       '400':
 *         description: Invalid name, or the active-key ceiling is reached
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const user_id = req.auth.userId
    const { name = '' } = req.body || {}

    if (typeof name !== 'string' || name.length > MAX_KEY_NAME_LENGTH) {
      return res.status(400).send({ error: 'invalid name' })
    }

    // Revoked keys do not count against the ceiling: they cannot authenticate,
    // and they are kept only so a user can see that a key they retired is
    // retired rather than missing.
    const [{ count }] = await db('user_api_keys')
      .count('* as count')
      .where({ user_id })
      .whereNull('revoked_at')

    if (Number(count) >= MAX_KEYS_PER_USER) {
      return res
        .status(400)
        .send({ error: `at most ${MAX_KEYS_PER_USER} active api keys` })
    }

    const { plaintext, key_hash, key_prefix } = generate_api_key()

    const [row] = await db('user_api_keys')
      .insert({ user_id, key_hash, key_prefix, name })
      .returning(public_key_columns)

    res.send({ ...row, key: plaintext })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /settings/api-keys/{api_key_id}:
 *   put:
 *     tags:
 *       - Settings
 *     summary: Rename an API key
 *     description: |
 *       Changes the label on one of the caller's active keys. The name is a
 *       reminder of what the key is for and carries no authorization meaning,
 *       so renaming never touches the hash, the prefix or the export ceiling.
 *       A revoked key cannot be renamed — its row is the audit record of a key
 *       that was retired, and that record does not change after the fact.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: The renamed key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKey'
 *       '400':
 *         description: Invalid api_key_id or name
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: No such active key belongs to the caller
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:api_key_id', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const user_id = req.auth.userId
    const api_key_id = Number(req.params.api_key_id)
    const { name } = req.body || {}

    if (!Number.isInteger(api_key_id) || api_key_id < 1) {
      return res.status(400).send({ error: 'invalid api_key_id' })
    }

    if (typeof name !== 'string' || name.length > MAX_KEY_NAME_LENGTH) {
      return res.status(400).send({ error: 'invalid name' })
    }

    // Same ownership predicate as the revoke route: the user_id in the WHERE is
    // the check, not the auth guard, which only proves who the caller is.
    const [row] = await db('user_api_keys')
      .where({ api_key_id, user_id })
      .whereNull('revoked_at')
      .update({ name })
      .returning(public_key_columns)

    if (!row) {
      return res.status(404).send({ error: 'invalid api_key_id' })
    }

    res.send(row)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /settings/api-keys/{api_key_id}:
 *   delete:
 *     tags:
 *       - Settings
 *     summary: Revoke an API key
 *     description: |
 *       Revokes one of the caller's keys. The row is kept with `revoked_at` set
 *       rather than deleted, so a key that was used stays visible in the audit
 *       the settings page shows. Idempotent.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Key revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 api_key_id:
 *                   type: integer
 *       '400':
 *         description: Invalid api_key_id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: No such key belongs to the caller
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:api_key_id', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const user_id = req.auth.userId
    const api_key_id = Number(req.params.api_key_id)

    if (!Number.isInteger(api_key_id) || api_key_id < 1) {
      return res.status(400).send({ error: 'invalid api_key_id' })
    }

    // The user_id predicate is the ownership check. Without it this route would
    // revoke any key in the table by id, which is the pre-guard-router shape
    // docs/guides/api.md records twice.
    const updated = await db('user_api_keys')
      .where({ api_key_id, user_id })
      .whereNull('revoked_at')
      .update({ revoked_at: new Date() })

    if (!updated) {
      const exists = await db('user_api_keys')
        .where({ api_key_id, user_id })
        .first()
      if (!exists) return res.status(404).send({ error: 'invalid api_key_id' })
    }

    res.send({ success: true, api_key_id })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
