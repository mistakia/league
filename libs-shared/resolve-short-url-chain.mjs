export const SHORT_URL_PATH_PREFIX = '/u/'
export const DEFAULT_MAX_DEPTH = 5

export default async function resolve_short_url_chain({
  initial_url,
  fetch_url_by_hash,
  max_depth = DEFAULT_MAX_DEPTH
}) {
  let url_object = new URL(initial_url)
  const visited = new Set()

  for (let depth = 0; depth < max_depth; depth++) {
    if (!url_object.pathname.startsWith(SHORT_URL_PATH_PREFIX)) {
      return url_object
    }

    const remainder = url_object.pathname.slice(SHORT_URL_PATH_PREFIX.length)
    const inner_hash = remainder.split('/')[0]
    if (!inner_hash) {
      return url_object
    }
    if (visited.has(inner_hash)) {
      throw new Error('short_url_cycle')
    }
    visited.add(inner_hash)

    const outer_search = url_object.search
    const inner_url_string = await fetch_url_by_hash(inner_hash)
    const inner_url = new URL(inner_url_string)

    // The outer search reflects the user's table state at copy-link time and
    // takes precedence. Fall back to the inner URL's stored search when the
    // outer URL has no params (e.g. a chain produced from an unmodified
    // shortened-URL page where the address bar was just /u/<hash>).
    if (outer_search) {
      inner_url.search = outer_search
    }

    url_object = inner_url
  }

  throw new Error('short_url_max_depth_exceeded')
}
