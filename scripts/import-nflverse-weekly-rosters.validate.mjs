// Source-shape preflight for import-nflverse-weekly-rosters.mjs.
//
// nflverse weekly_rosters releases follow a stable schema, but an upstream
// rename (column drop, status-enum shift) would silently corrupt downstream
// active=true/false bookkeeping. This validator asserts the columns and enum
// values the importer depends on are present before any database write.
//
// Required columns: season, week, team, status, game_type, gsis_id,
// full_name, first_name, last_name, entry_year. Optional fallbacks
// (birth_date, gsis_it_id, esb_id) are used opportunistically and not
// asserted here -- a missing fallback ID degrades resolution rate, doesn't
// corrupt data.
//
// status enum sanity: requires ACT (every season has dressed players) plus
// at least one non-ACT status token (every season has reserves / cuts /
// trades / inactives). Pre-2020 data has no INA token -- the older enum
// uses RES / SUS / PUP / RSN -- so the validator stays year-agnostic.

const REQUIRED_COLUMNS = [
  'season',
  'week',
  'team',
  'status',
  'game_type',
  'gsis_id',
  'full_name',
  'first_name',
  'last_name',
  'entry_year'
]

export const validate_response_shape = ({ rows }) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('validate_response_shape: rows missing or empty')
  }

  const sample = rows[0]
  for (const col of REQUIRED_COLUMNS) {
    if (!(col in sample)) {
      throw new Error(
        `validate_response_shape: required column '${col}' missing from CSV; ` +
          `columns present: ${Object.keys(sample).join(', ')}`
      )
    }
  }

  const status_counts = new Map()
  for (const row of rows) {
    const s = row.status || ''
    status_counts.set(s, (status_counts.get(s) || 0) + 1)
  }

  const act_count = status_counts.get('ACT') || 0
  if (act_count === 0) {
    throw new Error(
      `validate_response_shape: zero ACT entries across ${rows.length} rows -- enum likely renamed.`
    )
  }

  const non_act_total = rows.length - act_count
  if (non_act_total === 0) {
    throw new Error(
      `validate_response_shape: every one of ${rows.length} rows is ACT -- ` +
        'no reserves/cuts/inactives present, enum likely collapsed upstream.'
    )
  }

  return {
    rows: rows.length,
    status_counts: Object.fromEntries(status_counts)
  }
}

export default validate_response_shape
