import db from '#db'
import {
  page_meta_league_id,
  resolve_page_meta
} from '#libs-shared/page-meta.mjs'

// League names change rarely and this runs on every page load of a league
// route, so a short TTL keeps the read off the hot path without going stale for
// long. A failed lookup caches null for the same window rather than retrying
// per request.
const league_name_ttl_ms = 5 * 60 * 1000
const league_name_cache = new Map()

const get_league_name = async (lid) => {
  const league_id = Number(lid)
  if (!Number.isInteger(league_id) || league_id <= 0) return null

  const cached = league_name_cache.get(league_id)
  if (cached && cached.expires_at > Date.now()) return cached.name

  let name = null
  try {
    const row = await db('leagues').select('name').where({ league_id }).first()
    name = (row && row.name) || null
  } catch (error) {
    // Metadata is never worth a failed page load.
    name = null
  }

  league_name_cache.set(league_id, {
    name,
    expires_at: Date.now() + league_name_ttl_ms
  })

  return name
}

export const clear_league_name_cache = () => league_name_cache.clear()

// Server-side entry point: resolves the one value the shared derivation cannot
// look up for itself, then hands off.
export const get_page_meta = async ({ url_path, origin }) => {
  const lid = page_meta_league_id(url_path)
  const league_name = lid ? await get_league_name(lid) : null

  return resolve_page_meta({ url_path, origin, league_name })
}
