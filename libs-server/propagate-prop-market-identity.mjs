import debug from 'debug'

import db from '#db'

const log = debug('propagate-prop-market-identity')

// Identity columns describe WHAT a market is, not what it was priced at.
//
// The index tables carry two rows per market, OPEN and CLOSE, and the OPEN row
// is written once when the market is first seen. That is deliberate for
// price-like columns -- odds_american, odds_decimal, selection_metric_line,
// observed_at -- whose whole purpose on the OPEN row is to preserve the opening
// value. It strands the identity columns with it: a market_type or a
// selection_pid that the importer could not resolve on the first observation
// stays null on OPEN forever, however correct the importer later becomes.
//
// A null identity column is a DEFECT rather than a measurement, so filling one
// is a repair and not a revision. Settlement reads both time_types and grades
// each independently (libs-server/prop-market-settlement/prop-market-utils.mjs),
// so an OPEN row missing market_type or selection_pid cannot be settled at all.
//
// Every statement below is column-targeted and null-guarded, and both properties
// are load-bearing:
//
//   - Column-targeted. The SET list names only identity columns, so no
//     price-like column can be written by accident. This is why the propagation
//     is an UPDATE and not an upsert: an upsert needs a whole row, and a
//     whole-row merge onto OPEN is precisely the damage being avoided. Measured
//     on production 2026-09-02, a whole-row merge would have rewritten
//     observed_at on 3,453,203 of 5,242,560 OPEN/CLOSE selection pairs and
//     odds_american on 2,180,489 of them. The row count does not change when
//     that happens, so a count-based check is blind to it.
//
//   - Null-guarded. coalesce keeps a value already present, so a later
//     observation can fill a gap but never revise a stamp. That matters most for
//     esbid, which names the GAME a market is graded against: re-stamping a
//     settled market onto a different game is a defect this codebase has already
//     had once, and restricting the write to nulls makes re-stamping structurally
//     impossible here rather than a matter of care.
export const MARKET_IDENTITY_COLUMNS = ['market_type', 'esbid', 'season_year']

export const SELECTION_IDENTITY_COLUMNS = ['selection_pid', 'selection_type']

const has_any_identity_value = (record, columns) =>
  columns.some(
    (column) => record[column] !== null && record[column] !== undefined
  )

const normalize = (record, columns) => {
  const normalized = {}
  for (const column of columns) {
    normalized[column] = record[column] ?? null
  }
  return normalized
}

// Propagate market_type, esbid and season_year onto the OPEN market row.
//
// Takes [{ source_id, source_market_id, market_type, esbid, season_year }].
// Returns the number of OPEN rows updated.
export const propagate_market_identity_to_open = async (propagations) => {
  const candidates = propagations
    .filter((propagation) =>
      has_any_identity_value(propagation, MARKET_IDENTITY_COLUMNS)
    )
    .map((propagation) => ({
      source_id: propagation.source_id,
      source_market_id: String(propagation.source_market_id),
      ...normalize(propagation, MARKET_IDENTITY_COLUMNS)
    }))

  if (candidates.length === 0) {
    return 0
  }

  const result = await db.raw(
    `update prop_markets_index as m
        set market_type = coalesce(m.market_type, v.market_type),
            esbid = coalesce(m.esbid, v.esbid),
            season_year = coalesce(m.season_year, v.season_year)
       from jsonb_to_recordset(?::jsonb) as v(
              source_id text,
              source_market_id text,
              market_type text,
              esbid bigint,
              season_year smallint
            )
      where m.source_id = v.source_id::market_source_id
        and m.source_market_id = v.source_market_id
        and m.time_type = 'OPEN'
        and ((m.market_type is null and v.market_type is not null)
          or (m.esbid is null and v.esbid is not null)
          or (m.season_year is null and v.season_year is not null))`,
    [JSON.stringify(candidates)]
  )

  log(`Propagated market identity to ${result.rowCount} OPEN market row(s)`)

  return result.rowCount
}

// Propagate selection_pid and selection_type onto the OPEN selection row.
//
// Takes [{ source_id, source_market_id, source_selection_id, selection_pid,
// selection_type }]. Returns the number of OPEN rows updated.
export const propagate_selection_identity_to_open = async (propagations) => {
  const candidates = propagations
    .filter((propagation) =>
      has_any_identity_value(propagation, SELECTION_IDENTITY_COLUMNS)
    )
    .map((propagation) => ({
      source_id: propagation.source_id,
      source_market_id: String(propagation.source_market_id),
      source_selection_id: String(propagation.source_selection_id),
      ...normalize(propagation, SELECTION_IDENTITY_COLUMNS)
    }))

  if (candidates.length === 0) {
    return 0
  }

  const result = await db.raw(
    `update prop_market_selections_index as s
        set selection_pid = coalesce(s.selection_pid, v.selection_pid),
            selection_type = coalesce(s.selection_type, v.selection_type::selection_type)
       from jsonb_to_recordset(?::jsonb) as v(
              source_id text,
              source_market_id text,
              source_selection_id text,
              selection_pid text,
              selection_type text
            )
      where s.source_id = v.source_id::market_source_id
        and s.source_market_id = v.source_market_id
        and s.source_selection_id = v.source_selection_id
        and s.time_type = 'OPEN'
        and ((s.selection_pid is null and v.selection_pid is not null)
          or (s.selection_type is null and v.selection_type is not null))`,
    [JSON.stringify(candidates)]
  )

  log(
    `Propagated selection identity to ${result.rowCount} OPEN selection row(s)`
  )

  return result.rowCount
}
