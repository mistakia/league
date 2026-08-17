import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  is_main,
  find_player_row,
  report_job,
  batch_insert,
  throw_if_shortfall,
  fetch_dynasty_rankings_players,
  has_liquidity_data,
  write_zero_liquidity_payload_summary,
  build_liquidity_inserts,
  liquidity_observed_at
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

// console.log, not debug, throughout. This job's log file is the only durable
// record that a recovery slot fired and what it did. `debug` resolves against a
// namespace set any module in the ESM import graph can replace, and a logger
// constructed at module scope is not reliably re-enabled by a later
// `debug.enable`: measured on the league host 2026-08-05, this script printed
// nothing at all that way while exiting 0.

// Recovery pass for the days KeepTradeCut serves an all-zero liquidity payload
// at the 04:30 ET import slot. The daily importer correctly refuses to write a
// zeroed payload -- a stored zero must mean "KTC reported zero", never "we did
// not collect it" -- but nothing retried, so that day's liquidity was simply
// lost and the next run wrote under the next day's observed_at.
//
// Why a second slot rather than an in-run retry. The zeroed window's length is
// not known: the one measurement (2026-07-30) brackets recovery somewhere
// between 04:30 and 21:54, which is too wide to size a backoff from. And the
// 04:30 importer heads an ordering-critical chain (04:30 import, 04:45
// calculate-team-daily-ktc-value, 05:00 generate-roster-asset-lineage, 05:15
// calibrate-composite-market-value-sources, 05:45 generate-composite-market-value),
// so a retry loop long enough to outlast an hours-long window would push the
// import past the job that reads its output. keeptradecut_liquidity has no
// consumers at all, so this pass carries no ordering constraint of its own and
// is free to sit wherever the recovery odds are best.
//
// Two slots rather than one, because which slot recovers IS the measurement of
// the zeroed window that no instrumentation pass has been able to collect.
//
// This is deliberately a separate script from import-keeptradecut.mjs rather
// than a flag on it: it reports under its own job_type, so its failures cannot
// auto-close the daily importer's pipeline_failure signal and vice versa (the
// one-script-two-cron-entries-one-ledger-source defect, league fb16e0151).

// Liquidity is written only for players carrying a page record and a resolvable
// pid. Rookie draft picks (position RDP) never carry liquidity, so they are not
// part of the intended domain and must not drag the coverage fraction down.
const is_liquidity_eligible = (player) =>
  Boolean(player) && player.position !== 'RDP'

// A collapse floor, not a quality gate. Baselined against the table's own recent
// output rather than a magic constant, so it tracks roster churn: a run that
// resolves less than half of what the last healthy day wrote has lost its player
// resolution, which presents as a clean exit-0 run writing far too little.
export const COVERAGE_COLLAPSE_FRACTION = 0.5
const COVERAGE_REFERENCE_DAYS = 7

export const classify_liquidity_recovery = ({
  page_player_count,
  eligible_player_count,
  resolved_player_count,
  rows_written,
  reference_rows
}) => {
  const shortfalls = []

  // An empty domain is a broken fetch, never good news -- report the
  // denominator so a zero is visible rather than inferred.
  if (!page_player_count) {
    shortfalls.push(
      'domain: dynasty-rankings page yielded 0 players; nothing could be collected'
    )
    return { shortfalls, coverage_fraction: null }
  }

  if (!resolved_player_count) {
    shortfalls.push(
      `resolution: 0 of ${eligible_player_count} liquidity-eligible page players resolved to a pid`
    )
  }

  if (!rows_written) {
    shortfalls.push(
      `write: resolved ${resolved_player_count} player(s) but wrote 0 liquidity rows`
    )
  }

  const coverage_fraction = reference_rows
    ? rows_written / reference_rows
    : null
  if (
    reference_rows &&
    rows_written &&
    coverage_fraction < COVERAGE_COLLAPSE_FRACTION
  ) {
    shortfalls.push(
      `coverage: wrote ${rows_written} rows against a recent best of ${reference_rows} (${(coverage_fraction * 100).toFixed(1)}% < ${COVERAGE_COLLAPSE_FRACTION * 100}% floor)`
    )
  }

  return { shortfalls, coverage_fraction }
}

const count_rows_for_day = async (observed_at) => {
  const row = await db('keeptradecut_liquidity')
    .where('observed_at', observed_at)
    .count({ row_count: '*' })
    .first()
  return Number(row?.row_count || 0)
}

// Highest single-day row count over the trailing window, excluding today. The
// maximum rather than the mean: a partial day already in the table would drag a
// mean down and soften the floor exactly when it should hold.
const find_reference_row_count = async (observed_at) => {
  const rows = await db('keeptradecut_liquidity')
    .select('observed_at')
    .count({ row_count: '*' })
    .where(
      'observed_at',
      '>=',
      dayjs(observed_at).subtract(COVERAGE_REFERENCE_DAYS, 'day').toDate()
    )
    .andWhere('observed_at', '<', observed_at)
    .groupBy('observed_at')
  return rows.reduce((max, row) => Math.max(max, Number(row.row_count || 0)), 0)
}

const import_keeptradecut_liquidity = async ({ dry = false } = {}) => {
  const observed_at = liquidity_observed_at()
  const observed_day = dayjs(observed_at).format('YYYY-MM-DD')

  const existing_rows = await count_rows_for_day(observed_at)
  if (existing_rows) {
    // The ordinary outcome on ~78% of days. Reported explicitly rather than
    // exiting quietly: a no-op and a silent failure must not share an
    // observable, and this line is what tomorrow's operator reads to confirm
    // the slot fired at all.
    console.log(
      `liquidity already collected for ${observed_day}: ${existing_rows} row(s) present; nothing to recover`
    )
    return {
      shortfall: null,
      outcome: 'already_collected',
      observed_day,
      existing_rows
    }
  }

  console.log(`no liquidity rows for ${observed_day}; attempting recovery`)

  const players_array = await fetch_dynasty_rankings_players()
  const page_player_count = players_array.length

  if (!has_liquidity_data(players_array)) {
    await write_zero_liquidity_payload_summary(players_array)
    return {
      shortfall: `liquidity: keeptradecut still publishing zero liquidity for all ${page_player_count} players at the recovery slot; no rows written for observed_at=${observed_day}`,
      outcome: 'still_zeroed',
      observed_day,
      page_player_count
    }
  }

  const eligible_players = players_array.filter(is_liquidity_eligible)
  let resolved_player_count = 0
  let rows_written = 0

  for (const keeptradecut_player of eligible_players) {
    let player_row
    try {
      player_row = await find_player_row({
        keeptradecut_player_id: keeptradecut_player.playerID
      })
    } catch (err) {
      console.error(
        `error resolving playerID ${keeptradecut_player.playerID}: ${err}`
      )
      continue
    }

    // Resolution by vendor id only. The daily importer additionally falls back
    // to a name/team/draft-year match and writes the id back onto the player
    // row; that is identity maintenance and belongs to the daily run, not to a
    // recovery pass whose only job is to fill one day of a snapshot table.
    if (!player_row) continue

    resolved_player_count++

    const liquidity_inserts = build_liquidity_inserts({
      pid: player_row.pid,
      keeptradecut_player,
      observed_at
    })

    if (!liquidity_inserts.length) continue

    if (dry) {
      rows_written += liquidity_inserts.length
      continue
    }

    await batch_insert({
      items: liquidity_inserts,
      batch_size: 5000,
      save: (batch) =>
        db('keeptradecut_liquidity')
          .insert(batch)
          .onConflict(['pid', 'is_superflex', 'observed_at'])
          .merge(['raw_liquidity', 'standardized_liquidity', 'trade_count'])
    })
    rows_written += liquidity_inserts.length
  }

  const reference_rows = await find_reference_row_count(observed_at)
  const { shortfalls, coverage_fraction } = classify_liquidity_recovery({
    page_player_count,
    eligible_player_count: eligible_players.length,
    resolved_player_count,
    rows_written,
    reference_rows
  })

  console.log(
    `recovered ${observed_day}: ${rows_written} row(s) from ${resolved_player_count} of ${eligible_players.length} eligible page players (reference best ${reference_rows}, coverage ${coverage_fraction === null ? 'n/a' : `${(coverage_fraction * 100).toFixed(1)}%`})${dry ? ' [DRY]' : ''}`
  )

  return {
    shortfall: shortfalls.length ? shortfalls.join('; ') : null,
    outcome: 'recovered',
    observed_day,
    page_player_count,
    resolved_player_count,
    rows_written,
    reference_rows
  }
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv)).argv
    const result = await import_keeptradecut_liquidity({ dry: argv.dry })
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    console.error(err)
  }

  await report_job({
    job_type: job_types.IMPORT_KEEPTRADECUT_LIQUIDITY,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_keeptradecut_liquidity
