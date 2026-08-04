import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season, external_data_sources } from '#constants'
import {
  is_main,
  batch_insert,
  get_game_team_implied_totals,
  report_job,
  emit_signal
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('generate-dst-market-projections')
debug.enable('generate-dst-market-projections')

const initialize_cli = () => yargs(hideBin(process.argv)).argv

// A market forecast of the single largest DST scoring component.
//
// NO vendor supplies defensive_points_against -- ESPN, PFF and Sleeper are all
// NULL on it, which is why the consensus used to carry a fabricated 0.0 and the
// whole DST board fit at r = 0.08. The opponent's market-implied team total IS
// that quantity, priced daily by a liquid market.
//
// This source deliberately supplies ONE stat and leaves every other column null.
// Two reasons, and both matter:
//
//   - weightProjections averages per stat, so contributing null everywhere else
//     means the vendors' sacks/interceptions/touchdowns pass through undiluted
//     while points-against is added. That only works because Part 1 stopped
//     reading "no opinion" as a zero; under the old behaviour this source would
//     have halved every other component.
//   - It is what measured best. Against 2025 (n = 508 team-games) the vendor
//     weekly board fits at r = 0.444; adding the market points-against lifts it
//     to 0.491. Also filling yards-against, three-and-outs and fourth-down stops
//     from shrunk prior-season rates scored 0.487 -- no better, and it biased
//     the level high. Components no market prices are left alone.
//
// Weekly only. A week-0 season row is NOT written: projections_index stores
// season totals at week 0 while calculate-points applies the per-game
// points-against threshold (max(x - 20, 0)), so a season-total points-against
// would score as a catastrophic penalty. That mismatch is latent today only
// because the column is never populated at week 0.
const SOURCE_ID = external_data_sources.XO_DST_MARKET

const generate_dst_market_projections = async ({
  season_year = current_season.year,
  dry_run = false
} = {}) => {
  const implied_totals = await get_game_team_implied_totals({
    season_year,
    season_type: 'REG'
  })

  const esbids = Object.keys(implied_totals)
  if (!esbids.length) {
    log(`no GAME_TEAM_TOTAL markets for ${season_year}`)
    return { inserts: 0, games: 0 }
  }

  const teams = await db('player')
    .where('primary_position', 'DST')
    .select('pid')
  const known_teams = new Set(teams.map((row) => row.pid))

  const inserts = []
  const unmatched = new Set()
  for (const esbid of esbids) {
    const { week, ...totals_by_team } = implied_totals[esbid]
    const sides = Object.keys(totals_by_team)
    if (sides.length !== 2) {
      // One side priced and not the other gives no opponent total, which is the
      // only thing this source produces.
      continue
    }

    for (const team of sides) {
      const opponent = sides.find((side) => side !== team)
      if (!known_teams.has(team)) {
        unmatched.add(team)
        continue
      }

      inserts.push({
        pid: team,
        sourceid: SOURCE_ID,
        season_year,
        season_type: 'REG',
        week,
        defensive_points_against: totals_by_team[opponent]
      })
    }
  }

  if (unmatched.size) {
    log(`WARNING unmatched team abbreviations: ${[...unmatched].join(', ')}`)
  }

  log(
    `built ${inserts.length} DST market projections across ${esbids.length} games for ${season_year}`
  )

  if (dry_run) {
    for (const row of inserts.slice(0, 10)) {
      log(
        `  week ${String(row.week).padStart(2)} ${row.pid.padEnd(4)} ` +
          `points_against=${row.defensive_points_against}`
      )
    }
    return { inserts: 0, games: esbids.length, built: inserts.length }
  }

  if (inserts.length) {
    await batch_insert({
      items: inserts,
      save: (items) =>
        db('projections_index')
          .insert(items)
          .onConflict([
            'sourceid',
            'pid',
            'userid',
            'week',
            'season_year',
            'season_type'
          ])
          .merge(),
      batch_size: 100
    })
    log(`saved ${inserts.length} DST market projections`)
  }

  return { inserts: inserts.length, games: esbids.length }
}

// Nothing schedules this generator: it is committed NOT ACTIVATED (the sources
// row is PENDING, and activation first needs the weekly DST calibration refit
// against a consensus reconstructed to include points-against). So there is no
// crontab entry to name, and a `scheduled-command` entity would be wrong twice
// over -- the league host runs no schedule-processor, so such an entity is
// inert, and base's schedule-processor would execute an `enabled: true` one for
// a job nobody intends to run yet. The source therefore takes the emitter-named
// `script:<repo-relative-path>` shape (cf. `script:scripts/import-3dep-dem.mjs`),
// which identifies the script rather than its scheduler and so stays correct if
// this is later put on a schedule. It previously named
// `user:scheduled-command/league/generate-dst-market-projections.md`, which has
// never existed, so every signal this script raised addressed nothing.
const SIGNAL_SOURCE = 'script:scripts/generate-dst-market-projections.mjs'

const main = async () => {
  const argv = initialize_cli()
  const season_year = argv.season_year
    ? Number(argv.season_year)
    : current_season.year
  let error
  let result

  try {
    result = await generate_dst_market_projections({
      season_year,
      dry_run: Boolean(argv.dry_run)
    })
  } catch (err) {
    error = err
    log(err)
  }

  // Output oracle distinct from the exit code: the script exits 0 when the
  // market has simply not posted lines yet, which is normal in the offseason and
  // must not read the same as a broken parser. Only a run that found games but
  // produced no rows is a failure -- that is the shape a source_market_id format
  // change would take, and it would otherwise be silent.
  const shortfall =
    !error && result && result.games > 0 && result.inserts === 0
      ? `found ${result.games} games with implied totals but produced 0 projections`
      : null

  await report_job({
    job_type: job_types.GENERATE_DST_MARKET_PROJECTIONS,
    error: error || (shortfall ? new Error(shortfall) : null)
  })

  if (error || shortfall) {
    await emit_signal({
      source: SIGNAL_SOURCE,
      kind: 'pipeline_failure',
      severity: error ? 'high' : 'medium',
      title: error
        ? `generate-dst-market-projections threw: ${error.message}`
        : 'generate-dst-market-projections produced no rows',
      payload: { error_message: error?.message, shortfall, ...result },
      dedup_key: `pipeline_failure:${SIGNAL_SOURCE}`
    })
  } else {
    await emit_signal({
      source: SIGNAL_SOURCE,
      kind: 'pipeline_success',
      severity: 'low',
      title: 'generate-dst-market-projections succeeded',
      dedup_key: `pipeline_success:${SIGNAL_SOURCE}`
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_dst_market_projections
