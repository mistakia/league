import debug from 'debug'

import config from '#config'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('content-feed-client')
enable_debug_namespaces('content-feed-client')

// The upstream is base's `GET /api/content-feed/items`, contracted in
// user-base at `text/base/content-feed-query-api.md`. It is a PUBLIC,
// anonymous, read-only endpoint over HTTP -- league holds no credential for it
// and stores none of what it returns.
//
// Why HTTP and not a database read: `content_feed` lives on the homelab side
// and the league API process cannot open a Postgres connection to it at all.
// Serving it live from the database would need a standing inbound tunnel from
// this VPS into the home network. Outbound HTTPS needs nothing.
//
// `base_url` is deliberately absent from the published dev and test configs, so
// the feature is OFF by default everywhere except production. An unset base URL
// is a DISABLED integration, not an error -- see `is_enabled` below.
const REQUEST_TIMEOUT_MS = 4000

// The slice league surfaces. Tags only -- there is deliberately no source
// allowlist or denylist, because the league repo is public and a committed list
// publishes whatever it names. The consequence, accepted by operator ruling, is
// that a topical classifier occasionally admits an off-topic item.
//
// These three are the CONTENT tags rather than the broad `nfl` tag. They buy
// topical precision only: measured across the corpus, both sets are ~100%
// Reddit and Twitter, so no tag subset here is a moderation boundary.
export const NFL_CONTENT_TAG_URIS = [
  'user:tag/content/nfl-analysis.md',
  'user:tag/content/nfl-breaking.md',
  'user:tag/content/nfl-injury.md'
]

// base mounts this route at its `anonymous` rate tier, which keys on the socket
// peer -- so league's entire server shares ONE 60/min bucket rather than one per
// visitor. The route-level cache is what keeps us far beneath that, and a caller
// that drops the cache would be rate-limited under ordinary traffic rather than
// merely slower.

/**
 * Whether this process is configured to talk to the content feed.
 *
 * Split from the fetch so a caller (and a test) can ask the question without
 * opening a socket.
 *
 * @returns {boolean}
 */
export const is_enabled = () => Boolean(config.content_feed_api?.base_url)

/**
 * Fetch feed items for a player.
 *
 * NEVER THROWS. Every failure mode -- disabled, non-200, network error,
 * timeout, malformed body -- returns an empty item list. This section of the
 * player page is supplementary, and an upstream outage must degrade it to
 * nothing rather than turn a player page into a 500.
 *
 * @param {object} params
 * @param {string} params.pid - league player id
 * @param {string[]} params.tag_uris - tag set defining the slice
 * @param {number} [params.limit] - upstream page size
 * @returns {Promise<{items: object[]}>}
 */
export const get_player_content_feed_items = async ({
  pid,
  tag_uris,
  limit = 50
}) => {
  if (!is_enabled()) {
    log('content feed api not configured, returning no items')
    return { items: [] }
  }

  if (!pid || !tag_uris?.length) {
    return { items: [] }
  }

  const url = new URL(
    '/api/content-feed/items',
    config.content_feed_api.base_url
  )
  url.searchParams.set('player_ids', pid)
  url.searchParams.set('tag_uris', tag_uris.join(','))
  url.searchParams.set('limit', String(limit))

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: 'application/json' }
    })

    // `!== 200`, never `!response.ok`: 202 sits inside the 2xx range and is
    // exactly the shape a challenge page takes -- an empty body dressed as
    // success.
    if (response.status !== 200) {
      // debug() is dark in production, so a failing upstream would otherwise be
      // invisible from outside the process.
      console.error(
        `content feed request failed with status ${response.status}`
      )
      return { items: [] }
    }

    const body = await response.json()

    if (!Array.isArray(body?.items)) {
      console.error('content feed response carried no items array')
      return { items: [] }
    }

    log(`content feed returned ${body.items.length} items for ${pid}`)
    return { items: body.items }
  } catch (error) {
    console.error(`content feed request errored: ${error.message}`)
    return { items: [] }
  }
}
