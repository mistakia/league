import crypto from 'crypto'

import db from '#db'
import { DATA_VIEW_DEFAULT_MAX_LIMIT } from '#libs-server/validators.mjs'

// Per-user API keys for the data-view export endpoint.
//
// A key AUTHENTICATES its owner: an export presenting one runs as that user, so
// a viewer-scoped column discloses exactly what it would to the same person
// signed in through the browser. What the key BUYS is a higher row ceiling,
// carried on the owner's `users.data_view_export_max_rows` -- NULL there means
// no ceiling. That column is admin-owned; nothing a user can reach writes it.
//
// Only the SHA-256 of a key is stored, so authentication is a single indexed
// lookup on the hash (constant-time by construction -- no comparison loop over
// stored secrets) and a leaked row cannot be replayed as a credential.
export const EXPORT_API_KEY_HEADER = 'x-api-key'

// The ceiling for a caller presenting no key. Far above any organic saved view,
// so the browser export button is unaffected, and low enough that an
// unauthenticated caller cannot ask the database for an unbounded scan.
export const EXPORT_DEFAULT_MAX_LIMIT = 100000

const KEY_BYTES = 32
const KEY_PREFIX_LENGTH = 12

export const hash_api_key = (plaintext) =>
  crypto.createHash('sha256').update(String(plaintext)).digest('hex')

/**
 * Mint a new plaintext key. Returned to the caller ONCE; only its hash is
 * persisted.
 *
 * @returns {{ plaintext: string, key_hash: string, key_prefix: string }}
 */
export const generate_api_key = () => {
  // base64url over 32 random bytes: URL- and header-safe, no padding, ~256 bits.
  const plaintext = crypto.randomBytes(KEY_BYTES).toString('base64url')
  return {
    plaintext,
    key_hash: hash_api_key(plaintext),
    key_prefix: plaintext.slice(0, KEY_PREFIX_LENGTH)
  }
}

/**
 * Resolve the export API key a request presents, if any.
 *
 * Touches `last_used_at` on a hit, which is what makes an unused or leaked key
 * visible in settings. The update is fire-and-forget: a failure to record the
 * timestamp must not fail the export.
 *
 * @param {object} opts
 * @param {object} opts.headers - request headers (express lowercases the names)
 * @param {object} [opts.database] - seam for tests; defaults to the app knex
 * @returns {Promise<{ api_key_id: number, user_id: number }|null>} null when no
 *   key is presented, or the presented key is unknown or revoked
 */
export const resolve_export_api_key = async ({
  headers = {},
  database = db
} = {}) => {
  const presented = headers[EXPORT_API_KEY_HEADER]
  if (!presented || typeof presented !== 'string') return null

  const row = await database('user_api_keys')
    .select('api_key_id', 'user_id')
    .where('key_hash', hash_api_key(presented))
    .whereNull('revoked_at')
    .first()

  if (!row) return null

  database('user_api_keys')
    .where({ api_key_id: row.api_key_id })
    .update({ last_used_at: new Date() })
    .catch(() => {})

  return { api_key_id: row.api_key_id, user_id: row.user_id }
}

/**
 * The row ceiling that applies to one export request.
 *
 * The ceiling belongs to the USER, not to the key -- a whitelisted user gets it
 * from the browser as well as from a script. Anonymous callers get the platform
 * default.
 *
 * @param {object} opts
 * @param {number|null} opts.user_id - the request's effective user
 * @param {object} [opts.database] - seam for tests; defaults to the app knex
 * @returns {Promise<number|null>} null for no ceiling
 */
export const resolve_export_max_limit = async ({ user_id, database = db }) => {
  if (!user_id) return EXPORT_DEFAULT_MAX_LIMIT

  const row = await database('users')
    .select('data_view_export_max_rows')
    .where({ id: user_id })
    .first()

  // A user row that vanished between auth and here is not a licence to run
  // unbounded, so an absent row falls back to the platform default rather than
  // to the no-ceiling reading of NULL.
  if (!row) return EXPORT_DEFAULT_MAX_LIMIT

  return row.data_view_export_max_rows
}

// Above this many rows an export is not written to or read from the result
// cache. The cache value is serialized whole on every read and write of a redis
// instance shared with the interactive paths, so a six-figure export would evict
// the working set to serve a request that is not going to repeat. Sized at the
// interactive ceiling, so everything a browser table could have asked for still
// caches exactly as it did before.
export const EXPORT_CACHE_MAX_ROWS = DATA_VIEW_DEFAULT_MAX_LIMIT
