// Source-shape preflight for import-players-nfl.mjs.
//
// The players import reads the public NFL Pro per-team roster endpoint
// (https://pro.nfl.com/api/teams/roster), which replaced the decommissioned
// NFL FDL v3 shield query. A silent upstream shape change -- field rename,
// status field dropped, empty payload -- would silently halt player creation
// and roster-status capture. This validator asserts the response shape before
// any database write.
//
// Required: a non-empty array of player objects, each carrying the invariant
// fields the importer maps. esbId/gsisId are intentionally NOT required --
// rookies/UDFAs routinely lack them and are matched by name/dob instead.

const REQUIRED_PLAYER_KEYS = ['displayName', 'position', 'status']

export const validate_response_shape = ({ players }) => {
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error(
      'validate_response_shape: players missing or empty (NFL Pro roster returned no players)'
    )
  }

  const sample = players[0]
  if (!sample || typeof sample !== 'object') {
    throw new Error(
      'validate_response_shape: first roster entry is not an object; payload shape likely changed'
    )
  }

  for (const key of REQUIRED_PLAYER_KEYS) {
    if (!(key in sample)) {
      throw new Error(
        `validate_response_shape: sample player missing '${key}'; keys present: ${Object.keys(
          sample
        ).join(', ')}`
      )
    }
  }

  const status_counts = new Map()
  for (const player of players) {
    const s = player?.status
    if (s) {
      const upper = String(s).toUpperCase().trim()
      status_counts.set(upper, (status_counts.get(upper) || 0) + 1)
    }
  }

  // At least the active cohort must be present; an all-empty status column
  // signals the status field was dropped or renamed upstream.
  if (status_counts.size === 0) {
    throw new Error(
      `validate_response_shape: zero status tokens across ${players.length} players -- status field likely dropped upstream.`
    )
  }

  return {
    players: players.length,
    status_tokens: Array.from(status_counts.keys()),
    status_counts: Object.fromEntries(status_counts)
  }
}

export default validate_response_shape
