/**
 * Backfill Players from nflverse weekly_rosters CSVs
 *
 * Reads roster_weekly_{year}.csv for each year in range and creates a
 * player row for every gsis_id present in the CSV but missing from the
 * `player` table. Required because historical NFL player coverage in our
 * DB is sparse (17-20% gap for 2002-2010 NFL players), which blocks
 * scripts/import-nfl-gamebook-starters.mjs from resolving early-era
 * starters via gsis_id.
 *
 * For each missing gsis_id, picks the CSV row with the most-complete
 * required fields and calls createPlayer().
 *
 * Usage:
 *   node scripts/backfill-players-from-nflverse-weekly-rosters.mjs --year 2003
 *   node scripts/backfill-players-from-nflverse-weekly-rosters.mjs --start_year 2002 --end_year 2013
 *   node scripts/backfill-players-from-nflverse-weekly-rosters.mjs --year 2003 --dry_run
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
import {
  is_main,
  report_job,
  fetch_with_retry,
  createPlayer,
  updatePlayer,
  find_player_row,
  readCSV
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('backfill-players-from-nflverse-weekly-rosters')
debug.enable('backfill-players-from-nflverse-weekly-rosters,create-player')

const stream_pipeline = promisify(pipeline)

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('year', { type: 'number' })
    .option('start_year', { type: 'number' })
    .option('end_year', { type: 'number' })
    .option('force_download', { type: 'boolean', default: false })
    .option('dry_run', { type: 'boolean', default: false }).argv

const release_url_for_year = (year) =>
  `https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_${year}.csv`

const download_csv = async ({ year, force_download = false }) => {
  const file_path = path.join(os.tmpdir(), `nflverse_roster_weekly_${year}.csv`)
  if (force_download || !fs.existsSync(file_path)) {
    log(`downloading ${release_url_for_year(year)}`)
    const response = await fetch_with_retry({ url: release_url_for_year(year) })
    if (!response.ok) {
      throw new Error(
        `nflverse weekly_rosters download failed for ${year}: ${response.status} ${response.statusText}`
      )
    }
    await stream_pipeline(response.body, fs.createWriteStream(file_path))
  }
  return file_path
}

// Score a CSV row by how many createPlayer-required fields are populated.
// Used to pick the "best" row for a player who appears across many weeks.
const REQUIRED_FOR_SCORE = [
  'first_name',
  'last_name',
  'birth_date',
  'entry_year',
  'position',
  'height',
  'weight'
]
const score_row = (r) => REQUIRED_FOR_SCORE.filter((f) => r[f]).length

// createPlayer's actual required set (mapped to player_data keys). Used only for
// accurate "why did the mint reject this row" diagnostics -- dob/nfl_draft_year are no
// longer required by createPlayer, so REQUIRED_FOR_SCORE would mis-report them.
const CREATE_PLAYER_REQUIRED = [
  'first_name',
  'last_name',
  'primary_position',
  'secondary_position',
  'position_depth',
  'height_inches',
  'weight_pounds'
]

// External-id columns find_player_row understands, used to resolve a candidate to
// an existing player before minting. gsis_player_id is excluded on purpose: the
// candidate set is precisely the gsis_ids missing from the player table, so it
// never resolves here -- the point is to catch the same person under a different id.
// Each entry is a canonical player DB column that is both the player_data key and
// the find_player_row lookup parameter -- one vocabulary, no translation.
const FIND_ROW_ID_COLUMNS = [
  'pfr_player_id',
  'esb_player_id',
  'gsis_it_player_id',
  'sportradar_player_id',
  'pff_player_id',
  'espn_player_id',
  'yahoo_player_id',
  'sleeper_player_id'
]

// Pre-normalize historical nflverse team codes that fixTeam doesn't know.
const NFLVERSE_TEAM_ALIASES = {
  SL: 'STL',
  BLT: 'BAL',
  CLV: 'CLE',
  HST: 'HOU',
  ARZ: 'ARI'
}

// Map a CSV row to the createPlayer playerData shape.
const csv_row_to_player_data = (r) => ({
  first_name: r.first_name,
  last_name: r.last_name,
  date_of_birth: r.birth_date,
  nfl_draft_year: Number(r.entry_year) || Number(r.rookie_year) || null,
  primary_position: r.position,
  secondary_position: r.depth_chart_position || r.position,
  position_depth: r.depth_chart_position || r.position,
  height_inches: r.height ? Number(r.height) : null,
  weight_pounds: r.weight ? Number(r.weight) : null,
  college: r.college || null,
  current_nfl_team: r.team ? NFLVERSE_TEAM_ALIASES[r.team] || r.team : null,
  gsis_player_id: r.gsis_id,
  esb_player_id: r.esb_id || null,
  gsis_it_player_id: r.gsis_it_id || null,
  espn_player_id: r.espn_id || null,
  sportradar_player_id: r.sportradar_id || null,
  yahoo_player_id: r.yahoo_id || null,
  rotowire_player_id: r.rotowire_id || null,
  pff_player_id: r.pff_id || null,
  pfr_player_id: r.pfr_id || null,
  fantasy_data_player_id: r.fantasy_data_id || null,
  sleeper_player_id: r.sleeper_id || null,
  draft_team: r.draft_club
    ? NFLVERSE_TEAM_ALIASES[r.draft_club] || r.draft_club
    : null,
  roster_status: 'CUT' // safest default; daily importers (Sleeper / NFL) will refresh
})

const backfill_year = async ({ year, force_download, dry_run }) => {
  const csv_path = await download_csv({ year, force_download })
  const rows = await readCSV(csv_path)
  if (rows instanceof Error) throw rows

  // All rows with a gsis_id are candidates; we don't filter by status here
  // because even DEV/CUT players can be starters in another week's CSV
  // (status changes mid-season).
  const candidates = rows.filter((r) => r.gsis_id)

  const csv_gsis = new Set(candidates.map((r) => r.gsis_id))
  const have = await db('player')
    .select('gsis_player_id')
    .whereIn('gsis_player_id', Array.from(csv_gsis))
  const have_set = new Set(have.map((r) => r.gsis_player_id))
  const missing_gsis = Array.from(csv_gsis).filter((g) => !have_set.has(g))

  log(
    `${year}: ${csv_gsis.size} unique gsis_ids in CSV, ${missing_gsis.length} missing from player table`
  )
  if (!missing_gsis.length) return { missing: 0, created: 0, failed: 0 }

  // Group rows by gsis_id and pick the best-scoring row per missing player.
  const by_gsis = new Map()
  for (const r of candidates) {
    if (have_set.has(r.gsis_id)) continue
    const existing = by_gsis.get(r.gsis_id)
    if (!existing || score_row(r) > score_row(existing)) {
      by_gsis.set(r.gsis_id, r)
    }
  }

  let created = 0
  let updated = 0
  let failed = 0
  const failure_samples = []
  for (const [gsis_id, r] of by_gsis.entries()) {
    const player_data = csv_row_to_player_data(r)
    if (dry_run) {
      created += 1
      continue
    }
    // The opaque serial removes the old content-derived-pid dedup oracle (regenerate a
    // deterministic name+draft+dob pid and look it up). Resolve a possible existing
    // player instead, then enrich it rather than inserting a duplicate. Resolution is
    // deliberately conservative because a wrong match WRITES this CSV row's external ids
    // onto an unrelated player -- a corruption the old mint-only script could not cause:
    //   1. By each external id the CSV carries, ONE AT A TIME. find_player_row ANDs a
    //      bundled multi-id query (and always ANDs sleeper_id), so passing several ids at
    //      once can zero out a real single-id match; every other call site passes one id
    //      key. First id hit wins.
    //   2. Else by name + pos + dob + draft year, but ONLY when a real discriminator
    //      (a non-stub dob or a draft year) is present, and the returned candidate is
    //      accepted for enrichment ONLY if its non-stub dob or its draft year actually
    //      agrees -- name + the broad expanded position group alone is too loose to
    //      authorize an id write, and would enrich a same-surname different person.
    // Ambiguous (MatchedMultiplePlayers) or any thrown error is a hard skip, never a
    // mint. A genuine no-match mints (a possible duplicate is later mergeable; wrongly
    // enriching a real player is not). The whole body is guarded so one bad record --
    // e.g. a placeholder name that makes createPlayer throw -- skips, not aborts the run.
    try {
      let existing
      let matched_by_id = false
      for (const id_column of FIND_ROW_ID_COLUMNS) {
        if (!player_data[id_column]) continue
        existing = await find_player_row({
          [id_column]: player_data[id_column]
        })
        if (existing) {
          matched_by_id = true
          break
        }
      }

      const has_discriminator =
        (player_data.date_of_birth &&
          player_data.date_of_birth !== '0000-00-00') ||
        Boolean(player_data.nfl_draft_year)
      if (!existing && has_discriminator) {
        const candidate = await find_player_row({
          name: `${player_data.first_name} ${player_data.last_name}`,
          pos: player_data.primary_position,
          date_of_birth: player_data.date_of_birth,
          nfl_draft_year: player_data.nfl_draft_year
        })
        const dob_agrees =
          candidate &&
          candidate.date_of_birth &&
          candidate.date_of_birth !== '0000-00-00' &&
          candidate.date_of_birth === player_data.date_of_birth
        const draft_agrees =
          candidate &&
          candidate.nfl_draft_year &&
          Number(candidate.nfl_draft_year) ===
            Number(player_data.nfl_draft_year)
        if (candidate && (dob_agrees || draft_agrees)) existing = candidate
      }

      if (existing) {
        const update = {}
        for (const k of [
          'gsis_player_id',
          'esb_player_id',
          'gsis_it_player_id',
          'espn_player_id',
          'sportradar_player_id',
          'yahoo_player_id',
          'rotowire_player_id',
          'pff_player_id',
          'pfr_player_id',
          'fantasy_data_player_id',
          'sleeper_player_id'
        ]) {
          if (player_data[k] && !existing[k]) update[k] = player_data[k]
        }
        if (!Object.keys(update).length) {
          failed += 1
          if (failure_samples.length < 5) {
            failure_samples.push({
              gsis_id,
              name: r.full_name,
              reason: `matched existing player (${matched_by_id ? 'by id' : 'by name'}); no new ids to add`
            })
          }
          continue
        }
        const changes = await updatePlayer({
          player_row: existing,
          update,
          allow_protected_props: false,
          source: 'nflverse'
        })
        if (changes) updated += 1
        else failed += 1
        continue
      }

      const result = await createPlayer(player_data)
      if (result) {
        created += 1
      } else {
        failed += 1
        if (failure_samples.length < 5) {
          // createPlayer swallows its own insert errors and returns null. Report the
          // missing required field(s) when that is the cause; otherwise say so honestly
          // rather than emit a misleading empty list (the insert failed for another
          // reason -- e.g. a NOT NULL column still un-relaxed pre-prep-01 -- see the
          // create-player debug log).
          const missing = CREATE_PLAYER_REQUIRED.filter((f) => !player_data[f])
          failure_samples.push({
            gsis_id,
            name: r.full_name,
            reason: missing.length
              ? `createPlayer rejected: missing ${missing.join(', ')}`
              : 'createPlayer returned null with no required field missing (see create-player log)'
          })
        }
      }
    } catch (err) {
      failed += 1
      if (failure_samples.length < 5) {
        failure_samples.push({
          gsis_id,
          name: r.full_name,
          reason: `resolution/mint failed: ${err.message}`
        })
      }
      continue
    }
  }

  log(
    `${year}: created ${created}, updated ${updated}, failed ${failed} (of ${missing_gsis.length} missing)`
  )
  if (failure_samples.length) {
    log('failure samples:')
    for (const s of failure_samples) log(s)
  }
  return { missing: missing_gsis.length, created, updated, failed }
}

const backfill_players = async ({
  year,
  start_year,
  end_year,
  force_download = false,
  dry_run = false
}) => {
  const years = []
  if (start_year && end_year) {
    if (start_year > end_year) {
      throw new Error(`start_year ${start_year} > end_year ${end_year}`)
    }
    for (let y = start_year; y <= end_year; y++) years.push(y)
  } else {
    years.push(year)
  }

  const totals = { missing: 0, created: 0, updated: 0, failed: 0 }
  for (const y of years) {
    const c = await backfill_year({ year: y, force_download, dry_run })
    for (const k of Object.keys(totals)) totals[k] += c[k]
  }

  log(`totals across ${years.length} year(s): ${JSON.stringify(totals)}`)
  return { totals }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await backfill_players({
      year: argv.year,
      start_year: argv.start_year,
      end_year: argv.end_year,
      force_download: argv.force_download,
      dry_run: argv.dry_run
    })
  } catch (err) {
    error = err
    log(err)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYERS_NFLVERSE,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default backfill_players
