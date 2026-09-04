import jwt from 'jsonwebtoken'
import { createHash } from 'node:crypto'
import config from '#config'
import { fetch_with_retry } from './proxy-manager.mjs'

// THIS CACHE IS A FILESYSTEM CACHE, SO EVERY SEGMENT OF A KEY IS A FILENAME.
//
// api/routes/cache.mjs joins the key onto a directory and opens it, so each
// slash-separated segment becomes one directory or file name and is bounded by
// the filesystem's 255-byte limit. Express decodes the route param, so the
// length that meets that limit is the segment's DECODED byte length -- not the
// length of the URL, which percent-escaping makes considerably longer.
//
// A segment over the limit fails `ENAMETOOLONG` on the write. The route turns
// that into an HTTP 500 and fetch_with_retry discards the body, so the caller
// sees a bare 500 labelled "(direct)" -- the label being an artifact of this
// module fetching our own API unproxied. Against a vendor importer that reads
// as the VENDOR rejecting the request, which is how ten Caesars competition
// tabs were written off as an upstream fault on 2026-09-04: the vendor served
// every one of them 200, and it was this cache that refused, at 692 bytes for
// the longest tab id.
//
// So an over-long segment is squeezed here, once, for every consumer. A segment
// already within the limit is returned BYTE-IDENTICAL, which is what makes this
// safe to apply to a live cache: no key that works today changes, and the only
// keys that move are ones whose reads return null and whose writes 500.
const CACHE_SEGMENT_MAX_BYTES = 255
const CACHE_SEGMENT_DIGEST_LENGTH = 16

/**
 * Squeeze one over-long key segment into a filename the filesystem accepts.
 *
 * The digest covers the WHOLE segment, so two tabs sharing a long prefix cannot
 * collide on the truncated head. The head is stripped to characters that decode
 * to themselves, so the replacement's encoded and decoded lengths are equal and
 * the bound holds on both sides of the route rather than only the near one.
 *
 * @param {string} segment
 * @returns {string}
 */
export const bound_cache_key_segment = (segment) => {
  const decoded = decodeURIComponent(segment)
  if (Buffer.byteLength(decoded, 'utf8') <= CACHE_SEGMENT_MAX_BYTES) {
    return segment
  }

  const digest = createHash('sha256')
    .update(segment)
    .digest('hex')
    .slice(0, CACHE_SEGMENT_DIGEST_LENGTH)

  // Keep the extension when there is one, so a squeezed cache file is still
  // recognisable as JSON on disk alongside its unsqueezed siblings.
  const extension_match = decoded.match(/\.[A-Za-z0-9]{1,10}$/)
  const extension = extension_match ? extension_match[0] : ''
  const suffix = `-${digest}${extension}`
  const head = decoded
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, CACHE_SEGMENT_MAX_BYTES - suffix.length)

  return `${head}${suffix}`
}

/**
 * @param {string} key
 * @returns {string}
 */
const bound_cache_key = (key) =>
  key.split('/').map(bound_cache_key_segment).join('/')

// The cache write endpoint is admin-gated (userId === 1) and verifies the bearer
// token with config.jwt.secret (api/routes/cache.mjs, expressjwt in api/index.mjs).
// Sign a fresh admin token per request rather than carrying a static one in
// config: a hard-coded token stops verifying on every jwt.secret rotation — the
// 2026-08-27 rotation invalidated the legacy league_api_auth_token and broke every
// importer's cache write with a 401 until re-signed — and a token signed with a
// retired secret is exactly the artifact a rotation retires. A per-call HMAC sign
// is cheap and always current.
const admin_bearer = () =>
  `Bearer ${jwt.sign({ userId: 1 }, config.jwt.secret)}`

// use_proxy: false -- this is our own xo.football API, not a vendor target.
export const set = async ({ key, value }) => {
  const url = `https://xo.football/api/cache${bound_cache_key(key)}`

  const data = await fetch_with_retry({
    url,
    method: 'POST',
    body: JSON.stringify(value),
    headers: {
      authorization: admin_bearer(),
      'Content-Type': 'application/json'
    },
    max_retries: 3,
    initial_delay: 1000,
    max_delay: 10000,
    use_proxy: false,
    response_type: 'json'
  })

  return data.value
}

// use_proxy: false -- this is our own xo.football API, not a vendor target.
export const get = async ({ key, max_age_ms = null }) => {
  let url = `https://xo.football/api/cache${bound_cache_key(key)}`
  if (max_age_ms != null) {
    url += `?max_age_ms=${max_age_ms}`
  }

  const data = await fetch_with_retry({
    url,
    max_retries: 3,
    initial_delay: 1000,
    max_delay: 10000,
    use_proxy: false,
    response_type: 'json'
  })

  return data.value
}
