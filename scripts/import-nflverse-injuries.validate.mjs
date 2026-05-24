// Source-shape preflight for import-nflverse-injuries.mjs.
//
// nflverse injuries releases follow a stable schema. A column rename or
// report_status enum drift would silently corrupt changelog writes. This
// validator asserts the columns and enum values the importer depends on
// are present before any database write.
//
// Required columns: season, week, game_type, team, gsis_id, full_name,
// first_name, last_name, report_status, report_primary_injury,
// practice_status. Optional: report_secondary_injury,
// practice_primary_injury, date_modified, position.
//
// report_status enum sanity: requires at least one Out/Doubtful/Questionable
// token across the file (every REG season has reported injuries). Case is
// titlecased on the wire (e.g. "Out", "Questionable"); the importer
// normalises via format_nflverse_report_status.

const REQUIRED_COLUMNS = [
  'season',
  'week',
  'game_type',
  'team',
  'gsis_id',
  'full_name',
  'first_name',
  'last_name',
  'report_status',
  'report_primary_injury',
  'practice_status'
]

const REPORT_STATUS_TOKENS = new Set(['OUT', 'DOUBTFUL', 'QUESTIONABLE'])

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
    const s = (row.report_status || '').toUpperCase().trim()
    status_counts.set(s, (status_counts.get(s) || 0) + 1)
  }

  let recognised = 0
  for (const tok of REPORT_STATUS_TOKENS) {
    recognised += status_counts.get(tok) || 0
  }
  if (recognised === 0) {
    throw new Error(
      `validate_response_shape: zero Out/Doubtful/Questionable report_status ` +
        `entries across ${rows.length} rows -- enum likely renamed. ` +
        `Observed: ${JSON.stringify(Object.fromEntries(status_counts))}`
    )
  }

  return {
    rows: rows.length,
    report_status_counts: Object.fromEntries(status_counts)
  }
}

export default validate_response_shape
