/**
 * Import NFLverse Injuries
 *
 * Fills the pre-2021 player_changelog.injury_status gap and the 2022
 * Sleeper blackout. nflverse injuries.csv covers 2009+ with one row per
 * (season, week, gsis_id) carrying report_status (Out/Doubtful/Questionable),
 * practice_status, primary/secondary injury text.
 *
 * Write strategy: delete-then-insert scoped by (source, year). The live
 * player_changelog has 244 existing (pid, prop, timestamp) duplicates, so
 * ON CONFLICT cannot be used -- we delete this source's prior rows for
 * the targeted year, then batch_insert fresh.
 *
 * Timestamps are synthetic: nfl_games.timestamp - 86400 (one day before
 * kickoff) so the row lands inside the changelog_signal CTE's (-7d, +3h)
 * window. Real-time consumers needing genuine event ordering must filter
 * on source.
 *
 * Source: https://github.com/nflverse/nflverse-data/releases/tag/injuries
 *
 * Usage:
 *   node scripts/import-nflverse-injuries.mjs --year 2024
 *   node scripts/import-nflverse-injuries.mjs --start_year 2009 --end_year 2022 --source nflverse-backfill
 *   node scripts/import-nflverse-injuries.mjs --year 2024 --dry_run
 */

import debug from 'debug'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam } from '#libs-shared'
import { current_season } from '#constants'
import {
  is_main,
  report_job,
  fetch_with_retry,
  batch_insert,
  throw_if_shortfall,
  readCSV
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

import { validate_response_shape } from './import-nflverse-injuries.validate.mjs'

const log = debug('import-nflverse-injuries')
debug.enable('import-nflverse-injuries')

const BATCH_SIZE = 500

// Maps nflverse report_status (titlecased on the wire) to the changelog
// injury_status enum. Probable returns null here -- our injury_status enum
// drops Probable (NFL retired the designation in 2016) -- but Probable IS
// preserved in practice.game_designation via format_nflverse_report_status_for_practice.
const format_nflverse_report_status = (raw) => {
  const s = (raw || '').toUpperCase().trim()
  if (s === 'OUT' || s === 'DOUBTFUL' || s === 'QUESTIONABLE') return s
  return null
}

// Practice.game_designation accepts the full pre-2016 enum including PROBABLE,
// which is the dominant 2009-2015 value (~2,200-3,000 rows/year). Dropping it
// would lose the bulk of the historical injury-report signal.
const format_nflverse_report_status_for_practice = (raw) => {
  const s = (raw || '').toUpperCase().trim()
  if (s === 'OUT' || s === 'DOUBTFUL' || s === 'QUESTIONABLE' || s === 'PROBABLE')
    return s
  return null
}

// nflverse practice_status -> short token. "Out (Definitely Will Not Play)"
// (2009-2015 only) collapses to DNP -- the player did not practice.
const format_nflverse_practice_status = (raw) => {
  const s = (raw || '').trim()
  if (s === 'Did Not Participate In Practice') return 'DNP'
  if (s === 'Limited Participation in Practice') return 'LP'
  if (s === 'Full Participation in Practice') return 'FP'
  if (s === 'Out (Definitely Will Not Play)') return 'DNP'
  return null
}

const combine_injuries = (primary, secondary) => {
  const p = (primary || '').trim()
  const s = (secondary || '').trim()
  if (p && s) return `${p} / ${s}`
  return p || s || null
}

// Legacy team codes that pre-date our fixTeam table.
const NFLVERSE_TEAM_ALIASES = {
  SL: 'STL',
  BLT: 'BAL',
  CLV: 'CLE',
  HST: 'HOU',
  ARZ: 'ARI'
}

const stream_pipeline = promisify(pipeline)

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('year', { type: 'number' })
    .option('start_year', { type: 'number' })
    .option('end_year', { type: 'number' })
    .option('source', {
      type: 'string',
      describe:
        'Source sentinel for inserted rows. Use "nflverse-backfill" for historical ' +
        'ingestion, "nflverse" for ongoing weekly poll.',
      default: 'nflverse'
    })
    .option('write_practice', {
      type: 'boolean',
      default: false,
      describe:
        'Also write rows to the practice table (pre-2020 backfill). Skip for ' +
        'ongoing nflverse polls since Rotowire owns 2020+ practice writes.'
    })
    .option('dry_run', { type: 'boolean', default: false })
    .option('force_download', { type: 'boolean', default: false }).argv

const release_url_for_year = (year) =>
  `https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_${year}.csv`

const download_csv = async ({ year, force_download = false }) => {
  const file_path = path.join(os.tmpdir(), `nflverse_injuries_${year}.csv`)
  if (force_download || !fs.existsSync(file_path)) {
    log(`downloading ${release_url_for_year(year)}`)
    const response = await fetch_with_retry({
      url: release_url_for_year(year)
    })
    if (!response.ok) {
      throw new Error(
        `nflverse injuries download failed for ${year}: ${response.status} ${response.statusText}`
      )
    }
    await stream_pipeline(response.body, fs.createWriteStream(file_path))
    log(`downloaded to ${file_path}`)
  } else {
    log(`using cached file: ${file_path}`)
  }
  return file_path
}

const parse_csv = async (file_path) => {
  const result = await readCSV(file_path)
  if (result instanceof Error) throw result
  return result
}

const build_player_index = async ({ gsis_ids }) => {
  if (!gsis_ids.size) return new Map()
  const rows = await db('player')
    .select('pid', 'gsisid')
    .whereIn('gsisid', Array.from(gsis_ids))
  return new Map(rows.map((r) => [r.gsisid, r]))
}

const build_name_index = async () => {
  // nflverse injuries CSV has no entry_year column; key on (fname, lname)
  // alone. Collisions exist (homonyms) -- last write wins, which keeps the
  // most recent draft year by query order. Higher false-match risk than the
  // weekly_rosters fallback, hence the 70% resolution-rate floor.
  const rows = await db('player')
    .select('pid', 'fname', 'lname')
    .orderBy('nfl_draft_year')
  const idx = new Map()
  for (const r of rows) {
    if (!r.fname || !r.lname) continue
    const key = `${r.fname.toLowerCase()}|${r.lname.toLowerCase()}`
    idx.set(key, r)
  }
  return idx
}

const build_game_index = async ({ year }) => {
  const rows = await db('nfl_games')
    .select('esbid', 'week', 'h', 'v', 'timestamp')
    .where({ year, seas_type: 'REG' })
  const idx = new Map()
  for (const g of rows) {
    const h = fixTeam(g.h)
    const v = fixTeam(g.v)
    idx.set(`${g.week}|${h}`, { esbid: g.esbid, tm: h, timestamp: g.timestamp })
    idx.set(`${g.week}|${v}`, { esbid: g.esbid, tm: v, timestamp: g.timestamp })
  }
  return idx
}

const resolve_pid = ({ row, player_by_gsis_id, name_idx }) => {
  if (row.gsis_id) {
    const p = player_by_gsis_id.get(row.gsis_id)
    if (p) return { pid: p.pid, via: 'gsis_id' }
  }
  if (row.first_name && row.last_name) {
    const key = `${row.first_name.toLowerCase()}|${row.last_name.toLowerCase()}`
    const p = name_idx.get(key)
    if (p) return { pid: p.pid, via: 'name' }
  }
  return null
}

const season_bounds = async ({ year }) => {
  const rows = await db('nfl_games')
    .min({ min_ts: 'timestamp' })
    .max({ max_ts: 'timestamp' })
    .where({ year, seas_type: 'REG' })
  const min_ts = rows[0]?.min_ts
  const max_ts = rows[0]?.max_ts
  if (!min_ts || !max_ts) return null
  // Widen by a week on each side to capture synthetic kickoff-minus-day rows.
  return { start: min_ts - 14 * 86400, end: max_ts + 14 * 86400 }
}

const import_for_year = async ({
  year,
  source_sentinel,
  write_practice,
  dry_run,
  force_download
}) => {
  log(`processing year ${year}`)
  const file_path = await download_csv({ year, force_download })
  const rows = await parse_csv(file_path)
  log(`parsed ${rows.length} rows from ${path.basename(file_path)}`)

  const validation = validate_response_shape({ rows })
  log(
    `preflight ok: ${validation.rows} rows; report_status counts=${JSON.stringify(
      validation.report_status_counts
    )}`
  )

  const reg_rows = rows.filter((r) => r.game_type === 'REG')
  log(`${reg_rows.length} REG rows after game_type filter`)

  const gsis_ids = new Set(reg_rows.map((r) => r.gsis_id).filter(Boolean))
  const player_by_gsis_id = await build_player_index({ gsis_ids })
  const name_idx = await build_name_index()
  const game_idx = await build_game_index({ year })

  const changelog_inserts = []
  const practice_inserts = []
  const counts = {
    resolved_gsis: 0,
    resolved_name: 0,
    unresolved_pid: 0,
    unresolved_game: 0,
    skipped_no_status: 0,
    practice_skipped_empty: 0
  }
  const unresolved_pid_samples = []

  for (const row of reg_rows) {
    const changelog_status = format_nflverse_report_status(row.report_status)
    const practice_game_designation = format_nflverse_report_status_for_practice(
      row.report_status
    )
    const practice_status = format_nflverse_practice_status(row.practice_status)
    const inj_text = combine_injuries(
      row.report_primary_injury,
      row.report_secondary_injury
    )

    // Skip the whole row if nothing useful for either table.
    if (!changelog_status && !practice_game_designation && !practice_status && !inj_text) {
      counts.skipped_no_status += 1
      continue
    }

    const pid_match = resolve_pid({ row, player_by_gsis_id, name_idx })
    if (!pid_match) {
      counts.unresolved_pid += 1
      if (unresolved_pid_samples.length < 10) {
        unresolved_pid_samples.push({
          full_name: row.full_name,
          team: row.team,
          gsis_id: row.gsis_id,
          week: row.week
        })
      }
      continue
    }
    if (pid_match.via === 'gsis_id') counts.resolved_gsis += 1
    else counts.resolved_name += 1

    let team
    try {
      const normalised = NFLVERSE_TEAM_ALIASES[row.team] || row.team
      team = fixTeam(normalised)
    } catch (err) {
      counts.unresolved_game += 1
      continue
    }
    const game = game_idx.get(`${row.week}|${team}`)
    if (!game || !game.timestamp) {
      counts.unresolved_game += 1
      continue
    }

    if (changelog_status) {
      changelog_inserts.push({
        pid: pid_match.pid,
        prop: 'injury_status',
        prev: '',
        new: changelog_status,
        timestamp: game.timestamp - 86400,
        source: source_sentinel
      })
    }

    if (write_practice) {
      // practice unique key is (pid, week, year, seas_type) -- no game_designation
      // or other column carries the row identity. Skip rows where every practice
      // field would be null (no signal to record).
      if (!practice_game_designation && !practice_status && !inj_text) {
        counts.practice_skipped_empty += 1
      } else {
        practice_inserts.push({
          pid: pid_match.pid,
          week: parseInt(row.week, 10),
          year,
          seas_type: 'REG',
          inj: inj_text,
          game_designation: practice_game_designation,
          practice_status,
          source: source_sentinel
        })
      }
    }
  }

  // Dedupe changelog inserts on (pid, timestamp).
  const cl_dedup = new Map()
  for (const ins of changelog_inserts) {
    cl_dedup.set(`${ins.pid}|${ins.timestamp}`, ins)
  }
  const before_cl_dedup = changelog_inserts.length
  changelog_inserts.length = 0
  changelog_inserts.push(...cl_dedup.values())
  if (before_cl_dedup !== changelog_inserts.length) {
    log(
      `deduped ${before_cl_dedup - changelog_inserts.length} changelog (pid,timestamp) duplicates -> ${changelog_inserts.length} rows`
    )
  }

  // Dedupe practice inserts on (pid, week, year, seas_type) -- matches the
  // table's unique constraint. Last write wins (covers mid-week team trade
  // where a player appears under two team rows in the CSV).
  const pr_dedup = new Map()
  for (const ins of practice_inserts) {
    pr_dedup.set(`${ins.pid}|${ins.week}|${ins.year}|${ins.seas_type}`, ins)
  }
  const before_pr_dedup = practice_inserts.length
  practice_inserts.length = 0
  practice_inserts.push(...pr_dedup.values())
  if (before_pr_dedup !== practice_inserts.length) {
    log(
      `deduped ${before_pr_dedup - practice_inserts.length} practice (pid,week,year,seas_type) duplicates -> ${practice_inserts.length} rows`
    )
  }

  const total_with_status =
    counts.resolved_gsis +
    counts.resolved_name +
    counts.unresolved_pid +
    counts.unresolved_game
  const resolved = counts.resolved_gsis + counts.resolved_name
  const resolution_rate = total_with_status > 0 ? resolved / total_with_status : 0
  log(
    `resolution: ${resolved}/${total_with_status} (${(resolution_rate * 100).toFixed(1)}%) ` +
      `[gsis=${counts.resolved_gsis} name=${counts.resolved_name} unresolved=${counts.unresolved_pid} ` +
      `no_game=${counts.unresolved_game} skipped_no_status=${counts.skipped_no_status} ` +
      `practice_skipped_empty=${counts.practice_skipped_empty}]`
  )
  log(
    `prepared writes: changelog=${changelog_inserts.length} practice=${practice_inserts.length} (write_practice=${write_practice})`
  )
  if (counts.unresolved_pid && unresolved_pid_samples.length) {
    log(`unresolved-pid samples (showing up to 10):`)
    for (const s of unresolved_pid_samples) log(s)
  }

  if (total_with_status > 0 && resolution_rate < 0.7) {
    return {
      shortfall: `nflverse injuries ${year}: resolution rate ${(resolution_rate * 100).toFixed(1)}% below 70% floor (resolved ${resolved}/${total_with_status})`,
      inserts_written: 0
    }
  }

  if (dry_run) {
    log(
      `dry_run: would write changelog=${changelog_inserts.length} practice=${practice_inserts.length} rows for ${year}`
    )
    return { shortfall: null, inserts_written: 0 }
  }

  // Delete-then-insert scoped by (source, year-window) for changelog,
  // by (source, year) for practice. practice has a clean per-year filter.
  const bounds = await season_bounds({ year })
  if (!bounds) {
    return {
      shortfall: `nflverse injuries ${year}: no REG games found in nfl_games -- cannot derive timestamp bounds`,
      inserts_written: 0
    }
  }
  const cl_deleted = await db('player_changelog')
    .where({ source: source_sentinel })
    .whereBetween('timestamp', [bounds.start, bounds.end])
    .del()
  log(
    `deleted ${cl_deleted} prior changelog rows where source='${source_sentinel}' and timestamp in [${bounds.start}, ${bounds.end}]`
  )

  await batch_insert({
    items: changelog_inserts,
    batch_size: BATCH_SIZE,
    save: async (batch) => {
      await db('player_changelog').insert(batch)
    }
  })
  log(
    `wrote ${changelog_inserts.length} changelog rows for ${year} with source=${source_sentinel}`
  )

  let practice_written = 0
  if (write_practice) {
    const pr_deleted = await db('practice')
      .where({ source: source_sentinel, year })
      .del()
    log(
      `deleted ${pr_deleted} prior practice rows where source='${source_sentinel}' and year=${year}`
    )

    await batch_insert({
      items: practice_inserts,
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('practice').insert(batch)
      }
    })
    practice_written = practice_inserts.length
    log(
      `wrote ${practice_written} practice rows for ${year} with source=${source_sentinel}`
    )
  }

  return {
    shortfall: null,
    inserts_written: changelog_inserts.length + practice_written
  }
}

const import_nflverse_injuries = async ({
  year,
  start_year,
  end_year,
  source_sentinel = 'nflverse',
  write_practice = false,
  dry_run = false,
  force_download = false
}) => {
  const years = []
  if (start_year && end_year) {
    if (start_year > end_year) {
      throw new Error(`start_year ${start_year} > end_year ${end_year}`)
    }
    for (let y = start_year; y <= end_year; y++) years.push(y)
  } else {
    years.push(year || current_season.year)
  }

  let total_written = 0
  const shortfalls = []
  for (const y of years) {
    const { shortfall, inserts_written } = await import_for_year({
      year: y,
      source_sentinel,
      write_practice,
      dry_run,
      force_download
    })
    total_written += inserts_written
    if (shortfall) shortfalls.push(shortfall)
  }

  log(`total rows written across ${years.length} year(s): ${total_written}`)
  return { shortfall: shortfalls.length ? shortfalls.join('; ') : null }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await import_nflverse_injuries({
      year: argv.year,
      start_year: argv.start_year,
      end_year: argv.end_year,
      source_sentinel: argv.source,
      write_practice: argv.write_practice,
      dry_run: argv.dry_run,
      force_download: argv.force_download
    })
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    log(err)
  }

  await report_job({
    job_type: job_types.IMPORT_NFLVERSE_INJURIES,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_nflverse_injuries
