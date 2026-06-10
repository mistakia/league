// Source-shape preflight for import-players-nflverse.mjs.
//
// nflverse players.parquet is the truth source for offseason UFA/CUT/RET
// transitions written to player.roster_status and player.current_nfl_team.
// An upstream column rename or enum collapse would silently corrupt those
// writes; this validator asserts the columns and status distribution the
// importer depends on are present before any database write.

const REQUIRED_COLUMNS = [
  'gsis_id',
  'otc_id',
  'status',
  'latest_team',
  'last_season'
]

const MIN_ROWS = 10000

export const validate_response_shape = ({ rows, is_offseason = false }) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('validate_response_shape: rows missing or empty')
  }

  if (rows.length < MIN_ROWS) {
    throw new Error(
      `validate_response_shape: only ${rows.length} rows (< ${MIN_ROWS}) -- upstream likely truncated.`
    )
  }

  const sample = rows[0]
  for (const col of REQUIRED_COLUMNS) {
    if (!(col in sample)) {
      throw new Error(
        `validate_response_shape: required column '${col}' missing; ` +
          `columns present: ${Object.keys(sample).join(', ')}`
      )
    }
  }

  const status_counts = new Map()
  for (const row of rows) {
    const s = row.status || ''
    status_counts.set(s, (status_counts.get(s) || 0) + 1)
  }

  // UFA enum-rename guard: a zero-UFA payload during the season indicates
  // upstream renamed the free-agent flag. In offseason the UFA distribution
  // can legitimately collapse to zero after free agency settles, so the
  // guard only throws in-season.
  const ufa_count = status_counts.get('UFA') || 0
  if (ufa_count === 0 && !is_offseason) {
    throw new Error(
      `validate_response_shape: zero UFA entries across ${rows.length} rows -- ` +
        'in-season free-agent flag missing, enum likely renamed upstream.'
    )
  }

  return {
    rows: rows.length,
    status_counts: Object.fromEntries(status_counts),
    ufa_zero_in_offseason: ufa_count === 0 && is_offseason
  }
}

export default validate_response_shape
