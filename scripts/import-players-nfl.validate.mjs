// Source-shape preflight for import-players-nfl.mjs.
//
// The NFL.com FDL GraphQL `viewer.players` query is the only live source of
// `player_changelog.nfl_status` events (INJURED_RESERVE / PUP / SUSPENDED /
// NFI / DID_NOT_REPORT). A silent schema change upstream -- field rename,
// enum collapse, status field dropped -- would silently halt nfl_status
// capture for the index. This validator asserts the response shape and
// status-enum presence before any database write.
//
// Required structure: array of edges, each with `.node.person.{displayName,
// birthDate, status}` and `.node.position`. Required enum behavior: at
// least one non-ACT status token across the sampled population (every
// season has IR/PUP/SUSP designations).

const REQUIRED_PERSON_KEYS = ['displayName', 'birthDate', 'status']
const ACTIVE_TOKEN = 'ACT'

export const validate_response_shape = ({ edges }) => {
  if (!Array.isArray(edges) || edges.length === 0) {
    throw new Error(
      'validate_response_shape: edges missing or empty (NFL FDL returned no players)'
    )
  }

  const sample = edges[0]?.node
  if (!sample || !sample.person) {
    throw new Error(
      'validate_response_shape: sample edge missing node.person; payload shape likely changed'
    )
  }

  for (const key of REQUIRED_PERSON_KEYS) {
    if (!(key in sample.person)) {
      throw new Error(
        `validate_response_shape: sample person missing '${key}'; keys present: ${Object.keys(
          sample.person
        ).join(', ')}`
      )
    }
  }

  if (!('position' in sample)) {
    throw new Error(
      'validate_response_shape: sample node missing position field'
    )
  }

  const status_counts = new Map()
  for (const edge of edges) {
    const s = edge?.node?.person?.status
    if (s) {
      const upper = String(s).toUpperCase().trim()
      status_counts.set(upper, (status_counts.get(upper) || 0) + 1)
    }
  }

  const act_count = status_counts.get(ACTIVE_TOKEN) || 0
  if (act_count === 0) {
    throw new Error(
      `validate_response_shape: zero ACT entries across ${edges.length} players -- enum likely renamed.`
    )
  }
  const non_act_total = edges.length - act_count
  if (non_act_total === 0) {
    throw new Error(
      `validate_response_shape: every one of ${edges.length} players is ACT -- ` +
        'no IR/PUP/SUSP/CUT/DEV status tokens present, enum likely collapsed.'
    )
  }

  return {
    players: edges.length,
    status_counts: Object.fromEntries(status_counts)
  }
}

export default validate_response_shape
