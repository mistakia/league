/**
 * Typed errors for the context-doc generators. Generators throw these for
 * lifecycle states that map to a specific HTTP status; the route inspects
 * `status` to respond rather than pattern-matching on messages.
 */

export class ContextDocError extends Error {
  constructor(message, { status = 500, code } = {}) {
    super(message)
    this.name = 'ContextDocError'
    this.status = status
    this.code = code
  }
}

/**
 * Thrown when a league exists but has no configured season for the requested
 * year (no `scoring_format_id`) — the `getLeague` LEFT JOIN still returns a
 * truthy league with null format/cap/date fields, which would otherwise emit a
 * degenerate doc. The route maps this to 404.
 */
export function season_not_configured_error(lid, year) {
  return new ContextDocError(
    `league ${lid} has no configured season for ${year}`,
    { status: 404, code: 'season_not_configured' }
  )
}
