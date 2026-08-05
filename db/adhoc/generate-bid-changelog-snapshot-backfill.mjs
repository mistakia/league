// Generate the bid_changelog backfill from the league host's daily pg_dump
// snapshots.
//
// This is committed for reproducibility, not because it is meant to be re-run:
// the snapshots it reads are not in the repository and roll off the host. It
// produced db/adhoc/2026-08-05-backfill-bid-changelog-from-snapshots.sql, whose
// header states what the reconstruction can and cannot see.
//
// Usage (after extracting each snapshot's tables to TSV):
//   node db/adhoc/generate-bid-changelog-snapshot-backfill.mjs \
//     --input tmp/rfa-snapshots --output db/adhoc/<file>.sql
//
// Input shape: one file per snapshot per table, named
// `<YYYY-MM-DD>-restricted_free_agency_bids.tsv` and
// `<YYYY-MM-DD>-restricted_free_agency_releases.tsv`, each the pg_dump `COPY`
// header line followed by tab-separated rows with `\N` for null.
//
// Called from a relative path by hand, so main() is invoked bare rather than
// through is_main -- which compares process.argv[1] verbatim and would silently
// do nothing here -- and it logs through console.log rather than debug, whose
// namespace the ESM import graph clobbers.

import fs from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

// The daily backups are taken at 00:00 in the host's own timezone, which is
// America/New_York. Every snapshot date here falls in July or August, so the
// offset is EDT throughout and can be written as a literal rather than resolved
// per row.
const SNAPSHOT_UTC_OFFSET = '-04'

const parse_copy_file = (file_path) => {
  const text = fs.readFileSync(file_path, 'utf8')
  const lines = text.split('\n')
  const header = lines[0]
  const column_match = header.match(/\(([^)]*)\)/)
  if (!column_match) {
    throw new Error(`no COPY column list in ${file_path}`)
  }
  const columns = column_match[1].split(',').map((column) => column.trim())

  const rows = []
  for (const line of lines.slice(1)) {
    if (!line || line === '\\.') continue
    const values = line.split('\t')
    const row = {}
    columns.forEach((column, index) => {
      const value = values[index]
      row[column] = value === '\\N' || value === undefined ? null : value
    })
    rows.push(row)
  }

  return { columns, rows }
}

const to_number = (value) => (value === null ? null : Number(value))

// Resolve a renamed column by which NAME the snapshot carries, never by which
// value is non-null. `??` reads a legitimately-null new column as absent and
// falls through to the retired name, which is `undefined` -- and `undefined`
// then fails an `=== null` test and coerces to `false`. That turned 208
// still-unsettled bids into "settled, unsuccessful" on the one snapshot where
// `is_successful` existed and was null, an invented settlement in an audit
// trail. Absent and null are different facts here and the column list is what
// distinguishes them.
const pick_column = (row, ...names) => {
  for (const name of names) {
    if (name in row) return row[name]
  }
  return null
}

// Normalize a bid row onto the shape bid_changelog records, absorbing the two
// schema shapes the snapshot window straddles: the 2026-08-02 restructure moved
// `player_tid` / `nominated` / `announced` onto the nomination and replaced
// `reason` with `outcome` / `outcome_detail`, and the boolean-prefix sweep
// renamed `succ` -> `is_successful` between the last two backups.
const normalize_bid_row = (row) => {
  const is_successful = pick_column(row, 'is_successful', 'succ')

  return {
    bid_id: to_number(row.uid),
    league_id: to_number(row.lid),
    team_id: to_number(row.tid),
    player_id: row.pid,
    season_year: to_number(row.year),
    bid_amount: to_number(pick_column(row, 'bid_amount', 'bid')),
    bid_user_id: to_number(row.userid),
    cancelled: to_number(row.cancelled),
    processed: to_number(row.processed),
    is_successful: is_successful === null ? null : is_successful === 't',
    // Only present from the 2026-08-03 snapshot onward. Recorded when available
    // and deliberately excluded from change detection below.
    outcome: pick_column(row, 'outcome'),
    outcome_detail: pick_column(row, 'outcome_detail')
  }
}

// The fields whose movement constitutes a real change to the bid. `outcome` is
// absent because it was assigned wholesale by a migration on 2026-08-02, so
// treating its appearance as a bid mutation would put a manager-facing change in
// the trail that no manager and no settlement made.
const change_detection_fields = [
  'league_id',
  'team_id',
  'player_id',
  'season_year',
  'bid_amount',
  'bid_user_id',
  'cancelled',
  'processed',
  'is_successful'
]

const state_signature = (bid, release_player_ids) =>
  JSON.stringify([
    ...change_detection_fields.map((field) => bid[field]),
    release_player_ids
  ])

const sql_literal = (value) => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `'${String(value).replace(/'/g, "''")}'`
}

const sql_player_id_array = (player_ids) =>
  player_ids.length
    ? `ARRAY[${player_ids.map(sql_literal).join(', ')}]::character varying(25)[]`
    : `ARRAY[]::character varying(25)[]`

const main = () => {
  const argv = yargs(hideBin(process.argv))
    .option('input', { type: 'string', demandOption: true })
    .option('output', { type: 'string', demandOption: true })
    .help().argv

  const snapshot_dates = fs
    .readdirSync(argv.input)
    .filter((name) => name.endsWith('-restricted_free_agency_bids.tsv'))
    .map((name) => name.replace('-restricted_free_agency_bids.tsv', ''))
    .sort()

  if (!snapshot_dates.length) {
    throw new Error(`no snapshots found in ${argv.input}`)
  }

  console.log(
    `read ${snapshot_dates.length} snapshots: ${snapshot_dates.join(', ')}`
  )

  const last_signature_by_bid_id = new Map()
  const emitted_rows = []
  let observed_bid_ids = 0

  for (const snapshot_date of snapshot_dates) {
    const { rows: bid_rows } = parse_copy_file(
      path.join(argv.input, `${snapshot_date}-restricted_free_agency_bids.tsv`)
    )
    const { rows: release_rows } = parse_copy_file(
      path.join(
        argv.input,
        `${snapshot_date}-restricted_free_agency_releases.tsv`
      )
    )

    const release_player_ids_by_bid_id = new Map()
    for (const release_row of release_rows) {
      const bid_id = to_number(release_row.restricted_free_agency_bid_id)
      if (!release_player_ids_by_bid_id.has(bid_id)) {
        release_player_ids_by_bid_id.set(bid_id, [])
      }
      release_player_ids_by_bid_id.get(bid_id).push(release_row.pid)
    }

    let snapshot_changes = 0
    for (const raw_row of bid_rows) {
      const bid = normalize_bid_row(raw_row)
      const release_player_ids = (
        release_player_ids_by_bid_id.get(bid.bid_id) || []
      ).sort()
      const signature = state_signature(bid, release_player_ids)

      if (last_signature_by_bid_id.get(bid.bid_id) === signature) continue
      if (!last_signature_by_bid_id.has(bid.bid_id)) observed_bid_ids += 1

      last_signature_by_bid_id.set(bid.bid_id, signature)
      snapshot_changes += 1

      emitted_rows.push({
        snapshot_date,
        bid,
        release_player_ids
      })
    }

    console.log(
      `${snapshot_date}: ${bid_rows.length} bids, ${snapshot_changes} recorded`
    )
  }

  const values = emitted_rows
    .map(({ snapshot_date, bid, release_player_ids }) =>
      [
        '  (',
        [
          `'restricted_free_agency'`,
          sql_literal(bid.bid_id),
          sql_literal(bid.league_id),
          sql_literal(bid.team_id),
          sql_literal(bid.player_id),
          sql_literal(bid.season_year),
          `'backfilled_snapshot'`,
          `'daily_snapshot_backfill'`,
          `TIMESTAMPTZ '${snapshot_date} 00:00:00${SNAPSHOT_UTC_OFFSET}'`,
          sql_literal(bid.bid_amount),
          sql_literal(bid.bid_user_id),
          bid.cancelled === null ? 'NULL' : `TO_TIMESTAMP(${bid.cancelled})`,
          bid.processed === null ? 'NULL' : `TO_TIMESTAMP(${bid.processed})`,
          sql_literal(bid.is_successful),
          sql_literal(bid.outcome),
          sql_literal(bid.outcome_detail),
          sql_player_id_array(release_player_ids)
        ].join(', '),
        ')'
      ].join('')
    )
    .join(',\n')

  const sql = `-- STATUS: PENDING
--
-- Backfill bid_changelog from the league host's daily pg_dump snapshots, so the
-- trail does not start empty on the day the table was created.
--
-- WHAT THIS IS
--
-- ${snapshot_dates.length} daily backups (${snapshot_dates[0]} through ${snapshot_dates[snapshot_dates.length - 1]}, each taken at
-- 00:00 America/New_York on the league host) were read, the
-- restricted_free_agency_bids and restricted_free_agency_releases tables
-- extracted from each, and a row emitted wherever a bid's audited state differs
-- from what the previous snapshot held -- plus one row at each bid's first
-- appearance. ${emitted_rows.length} rows across ${observed_bid_ids} bids.
--
-- Generated by db/adhoc/generate-bid-changelog-snapshot-backfill.mjs. It runs
-- BEFORE the live-state seed in 2026-08-05-create-bid-changelog.sql in wall
-- time (every changed_at here precedes it) but may be applied after; ordering is
-- by changed_at, not by insertion.
--
-- WHAT THIS CANNOT SEE, AND WHY THAT IS NOT PAPERED OVER
--
-- Granularity is 24 hours. A bid raised and lowered again between two midnights
-- leaves no trace at all, and one changed once shows the change stamped at the
-- following midnight rather than when the manager made it. Every changed_at in
-- this file is therefore an UPPER BOUND on when the change happened, not the
-- instant of it -- which is why these rows are change_type 'backfilled_snapshot'
-- rather than the codes the live writers use. Do not read them as observations.
--
-- The actor is unrecoverable, so changed_by_user_id is NULL on every row.
-- bid_user_id carries the bid's own userid, which is a different and weaker
-- fact: whoever last WROTE the row as of that midnight. Where a manager changed
-- their own bid it happens to be the actor; where a bid was cancelled it is not,
-- because the cancel path never touched userid.
--
-- Coverage starts ${snapshot_dates[0]}. Nothing before that date exists in any
-- form -- the older backups have rolled off the host -- so a bid submitted in an
-- earlier season has its first row here at whichever of these midnights it was
-- first observed, carrying the state it had already settled into.
--
-- The snapshot window straddles two schema changes, so the columns are not
-- uniform across it. The 2026-08-02 restructure moved \`player_tid\` /
-- \`nominated\` / \`announced\` to restricted_free_agency_nominations and replaced
-- the free-text \`reason\` with \`outcome\` / \`outcome_detail\`; the boolean-prefix
-- sweep then renamed \`succ\` -> \`is_successful\` between the 2026-08-04 and
-- 2026-08-05 backups. (\`bid\` -> \`bid_amount\` happened after the last backup, so
-- every snapshot here still spells it \`bid\`.) The generator resolves each rename
-- by which column NAME a snapshot carries rather than by which value is
-- non-null, because a legitimately-null new column is not the same fact as an
-- absent one.
--
-- It does NOT attempt to derive an outcome for the pre-restructure snapshots:
-- \`reason\` is exactly the column the restructure retired for carrying whatever
-- string happened to be in scope, and inventing a code from it would put a
-- fabricated fact in an audit trail. \`outcome\` is consequently NULL on every row
-- before 2026-08-03, and it is excluded from change detection so that its
-- wholesale assignment by that migration does not appear here as a change to
-- each bid -- which no manager and no settlement made.

INSERT INTO public.bid_changelog (
  bid_type,
  bid_id,
  league_id,
  team_id,
  player_id,
  season_year,
  change_type,
  change_source,
  changed_at,
  bid_amount,
  bid_user_id,
  cancelled_at,
  processed_at,
  is_successful,
  outcome,
  outcome_detail,
  conditional_release_player_ids
) VALUES
${values};

ANALYZE public.bid_changelog;
`

  fs.writeFileSync(argv.output, sql)
  console.log(
    `wrote ${argv.output}: ${emitted_rows.length} rows across ${observed_bid_ids} bids`
  )
}

main()
