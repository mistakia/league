import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { ChartingDataClient } from '#libs-server/charting-data/index.mjs'
import { match_charting_player } from '#libs-server/charting-data/player-matching.mjs'
import { preload_active_players } from '#libs-server/player-cache.mjs'
import grade_matchup_import_run from '#libs-server/charting-data/grade-matchup-import-run.mjs'

const log = debug('import-matchup-stats-charting')

// A debug.enable at module scope REPLACES the enabled namespace set for the
// whole process, and ESM evaluates imports before the importing module's body,
// so an unguarded call here would clobber whatever an entry point set. Guarding
// on DEBUG makes an explicit environment value authoritative and leaves this
// list as the default for a bare CLI run. Deferring it into main() instead is
// the documented way to silence the script entirely -- a logger constructed at
// module scope is not reliably re-enabled afterwards -- which is why every
// outcome line below goes through console.log rather than this logger.
if (!process.env.DEBUG) {
  debug.enable(
    'import-matchup-stats-charting,charting-data,charting-data:player-matching'
  )
}

// Charting data only exists once a game has been played, and a game still in
// progress is charted partially or not at all. Selecting one would count as a
// failed game against the oracle, so the window excludes anything that has not
// had time to finish.
const GAME_COMPLETION_BUFFER_HOURS = 6

const DEFAULT_SEASON_TYPES = ['REG', 'POST']

// BACKFILLING AN EARLIER SEASON DOES NOT WORK. Measured 2026-08-13: the vendor
// serves the CURRENT season only, and it is a rolling window -- 2025 answers
// with data while 2024, 2022 and 2021 answer `{"getPlayerMatchupStatsList":[]}`
// on a well-formed 200, indistinguishable from a game the vendor does not know.
// So a season not captured while it is current is likely gone, which is what
// the weekly schedule exists to prevent, and a backfill run costs one request
// per game to learn nothing. Probe one game before running one.
// See user:text/league/data-sources.md § SumerSports.

// Returns the games matching the scope and, separately, the subset still
// needing an import. A scheduled run repeats the same scope every week, so
// re-fetching games already covered would cost 272 vendor requests to rewrite
// rows that are already there; skipping them also makes the job self-healing,
// since a week missed for any reason is picked up by the next run.
async function get_games_for_import({ year, week, esbid, seas_type, force }) {
  const query = db('nfl_games')
    .select(
      'esbid',
      'shield_game_id',
      'season_year as year',
      'week',
      'season_type as seas_type',
      'home_nfl_team',
      'away_nfl_team'
    )
    .whereNotNull('shield_game_id')
    .where(
      'kickoff_at',
      '<',
      db.raw(`now() - interval '${GAME_COMPLETION_BUFFER_HOURS} hours'`)
    )

  if (esbid) {
    query.where('esbid', esbid)
  } else {
    query.where('season_year', year)
    if (week) {
      query.where('week', week)
    }
    if (seas_type) {
      query.where('season_type', seas_type)
    } else {
      // Preseason is excluded from the default scope. The vendor charts it, but
      // the rosters are camp bodies we largely do not carry: the 2026 Hall of
      // Fame game resolved 196 of 296 matchups, a 33.8% unmatched rate against
      // 3.6% across the 2025 regular season. Ask for it explicitly with
      // --seas_type PRE.
      query.whereIn('season_type', DEFAULT_SEASON_TYPES)
    }
  }

  query.orderBy(['season_year', 'week', 'esbid'])
  const games_selected = await query

  if (force || games_selected.length === 0) {
    return { games_selected, games_to_process: games_selected }
  }

  const covered_rows = await db('nfl_matchup_stats')
    .distinct('esbid')
    .whereIn(
      'esbid',
      games_selected.map((game) => game.esbid)
    )
  const covered_esbids = new Set(covered_rows.map((row) => row.esbid))

  return {
    games_selected,
    games_to_process: games_selected.filter(
      (game) => !covered_esbids.has(game.esbid)
    )
  }
}

function map_matchup_to_db_fields(matchup) {
  const result = {}

  // Convert percentage (0-100) to fraction (0-1) for rate columns
  const to_fraction = (val) => (val != null ? parseFloat(val) / 100 : null)

  // Map receiving matchup fields
  if (matchup.receivingRoutesRun != null)
    result.receiving_routes_run = matchup.receivingRoutesRun
  if (matchup.receivingTargets != null)
    result.receiving_targets = matchup.receivingTargets
  if (matchup.receivingReceptions != null)
    result.receiving_receptions = matchup.receivingReceptions
  if (matchup.receivingYards != null)
    result.receiving_yards = matchup.receivingYards
  if (matchup.receivingTouchdowns != null)
    result.receiving_touchdowns = matchup.receivingTouchdowns
  if (matchup.receivingYardsAfterCatch != null)
    result.receiving_yards_after_catch = matchup.receivingYardsAfterCatch
  if (matchup.receivingTargetRate != null)
    result.receiving_target_rate = to_fraction(matchup.receivingTargetRate)
  if (matchup.receivingCatchRate != null)
    result.receiving_catch_rate = to_fraction(matchup.receivingCatchRate)
  if (matchup.receivingYardsPerRouteRun != null)
    result.receiving_yards_per_route_run = matchup.receivingYardsPerRouteRun
  if (matchup.receivingEpa != null) result.receiving_epa = matchup.receivingEpa

  // Map defense fields
  if (matchup.defensePassBreakups != null)
    result.defense_pass_breakups = matchup.defensePassBreakups
  if (matchup.defensePressCoverageRate != null)
    result.defense_press_coverage_rate = to_fraction(
      matchup.defensePressCoverageRate
    )
  if (matchup.defenseNonpressCoverageRate != null)
    result.defense_nonpress_coverage_rate = to_fraction(
      matchup.defenseNonpressCoverageRate
    )
  if (matchup.defenseInterceptions != null)
    result.defense_interceptions = matchup.defenseInterceptions
  if (matchup.defenseAverageTimeToPressure != null)
    result.defense_avg_time_to_pressure = matchup.defenseAverageTimeToPressure
  if (matchup.defenseFumblesForced != null)
    result.defense_fumbles_forced = matchup.defenseFumblesForced

  // Map pressure/blocking fields
  if (matchup.pressureAllowedCount != null)
    result.pressure_allowed_count = matchup.pressureAllowedCount
  if (matchup.pressureAllowedRate != null)
    result.pressure_allowed_rate = to_fraction(matchup.pressureAllowedRate)
  if (matchup.sacksAllowed != null) result.sacks_allowed = matchup.sacksAllowed
  if (matchup.sackAllowedRate != null)
    result.sack_allowed_rate = to_fraction(matchup.sackAllowedRate)

  // Map general fields
  if (matchup.totalMatchupSnaps != null)
    result.total_matchup_snaps = matchup.totalMatchupSnaps
  if (matchup.doubleTeamCount != null)
    result.double_team_count = matchup.doubleTeamCount
  if (matchup.offensePlayerImpactPlays != null)
    result.offense_impact_plays = matchup.offensePlayerImpactPlays
  if (matchup.defensePlayerImpactPlays != null)
    result.defense_impact_plays = matchup.defensePlayerImpactPlays

  return result
}

function determine_matchup_type(matchup) {
  if (matchup.matchupType)
    return matchup.matchupType.toUpperCase().replace(/\s+/g, '_')
  if (matchup.receivingRoutesRun != null || matchup.receivingTargets != null)
    return 'RECEIVING'
  if (matchup.pressureAllowedCount != null || matchup.sacksAllowed != null)
    return 'PASS_BLOCK'
  return 'UNKNOWN'
}

const BATCH_SIZE = 500

async function process_game({ game, client, stats, dry = false }) {
  const { esbid, shield_game_id, week, year: season_year } = game

  log(
    `processing matchup stats for game ${esbid} (shield: ${shield_game_id}, week ${week})`
  )

  let matchup_data
  try {
    matchup_data = await client.get_matchup_stats({ game_id: shield_game_id })
  } catch (error) {
    log(`failed to fetch matchup stats for game ${esbid}: ${error.message}`)
    stats.games_failed += 1
    return
  }

  if (!matchup_data || !Array.isArray(matchup_data)) {
    log(`no matchup data returned for game ${esbid}`)
    stats.games_empty += 1
    return
  }

  log(`fetched ${matchup_data.length} matchup records for game ${esbid}`)

  const rows_to_insert = []

  for (const matchup of matchup_data) {
    const offense_pid = await match_charting_player({
      sumer_player_id: matchup.offensePlayerId,
      football_name: matchup.offensePlayerFootballName,
      last_name: matchup.offensePlayerLastName,
      team_code: matchup.offensePlayerTeamCode,
      jersey_number: matchup.offensePlayerJerseyNumber,
      position: matchup.offensePlayerPosition,
      // The game's own season, not the player's team today -- see
      // libs-server/charting-data/player-matching.mjs.
      season_year
    })

    const defense_pid = await match_charting_player({
      sumer_player_id: matchup.defensePlayerId,
      football_name: matchup.defensePlayerFootballName,
      last_name: matchup.defensePlayerLastName,
      team_code: matchup.defensePlayerTeamCode,
      jersey_number: matchup.defensePlayerJerseyNumber,
      position: matchup.defensePlayerPosition,
      season_year
    })

    if (!offense_pid || !defense_pid) {
      stats.players_unmatched += 1
      continue
    }

    const matchup_type = determine_matchup_type(matchup)
    const db_fields = map_matchup_to_db_fields(matchup)

    rows_to_insert.push({
      esbid,
      offense_player_id: offense_pid,
      defense_player_id: defense_pid,
      matchup_type,
      ...db_fields
    })
  }

  if (!dry && rows_to_insert.length > 0) {
    try {
      for (let i = 0; i < rows_to_insert.length; i += BATCH_SIZE) {
        const batch = rows_to_insert.slice(i, i + BATCH_SIZE)
        await db('nfl_matchup_stats')
          .insert(batch)
          .onConflict([
            'esbid',
            'offense_player_id',
            'defense_player_id',
            'matchup_type'
          ])
          .merge()
      }
    } catch (error) {
      // One unwritable row used to abort the whole remaining run: this insert
      // sat outside the fetch try, so the earliest recorded run of this job
      // died mid-season on `numeric field overflow` and every later game went
      // unimported. Losing one game is the smaller failure, and the oracle
      // fails the run once enough games are lost.
      console.error(`game ${esbid}: insert failed -- ${error.message}`)
      stats.games_failed += 1
      return
    }
  }

  stats.games_processed += 1
  stats.total_matchups_inserted += rows_to_insert.length
  if (rows_to_insert.length > 0) {
    stats.games_with_rows += 1
  } else {
    stats.games_empty += 1
  }

  log(
    `game ${esbid}: ${rows_to_insert.length}/${matchup_data.length} matchups processed`
  )
}

export async function import_matchup_stats_charting({
  year = current_season.year,
  week,
  esbid,
  dry = false,
  proxy_pool = 'default',
  use_proxy = true,
  request_delay = 3000,
  seas_type = null,
  force = false,
  collector = null
} = {}) {
  console.time('import-matchup-stats-charting')
  console.log(
    `starting charting matchup stats import: year=${year} week=${week || 'all'} esbid=${esbid || 'all'} dry=${dry} force=${force}`
  )

  const client = new ChartingDataClient({
    proxy_pool,
    use_proxy,
    request_delay_ms: request_delay
  })

  // Preload player cache for matching
  await preload_active_players({ all_players: true })

  const { games_selected, games_to_process } = await get_games_for_import({
    year,
    week,
    esbid,
    seas_type,
    force
  })
  console.log(
    `selected ${games_selected.length} played game(s) in scope, ${games_to_process.length} needing import`
  )

  const stats = {
    games_selected: games_selected.length,
    games_attempted: games_to_process.length,
    games_processed: 0,
    games_with_rows: 0,
    games_failed: 0,
    games_empty: 0,
    total_matchups_inserted: 0,
    players_unmatched: 0
  }

  for (const game of games_to_process) {
    await process_game({ game, client, stats, dry })
  }

  console.timeEnd('import-matchup-stats-charting')

  // The oracle lives here rather than in main() so every caller is graded --
  // import-full-season.mjs runs this import too, and a stage that idles there
  // is as invisible as one that idles under cron.
  const grade = grade_matchup_import_run({
    ...stats,
    // A season-wide scope on the CURRENT season may hold no completed game yet;
    // any narrower ask (a week, a game, an earlier season) named something the
    // caller expects to exist.
    expects_games: Boolean(week || esbid) || year !== current_season.year
  })
  console.log(grade.summary)
  if (!grade.passed) {
    throw new Error(grade.summary)
  }

  return stats
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('year', {
        type: 'number',
        description: 'Year to import',
        default: current_season.year
      })
      .option('week', {
        type: 'number',
        description: 'Specific week to import'
      })
      .option('esbid', {
        type: 'number',
        description: 'Specific game ID to import'
      })
      .option('dry', {
        type: 'boolean',
        description: 'Dry run mode',
        default: false
      })
      .option('proxy_pool', {
        type: 'string',
        description: 'Proxy pool name',
        default: 'default'
      })
      .option('request_delay', {
        type: 'number',
        description: 'Delay between requests (ms)',
        default: 3000
      })
      .option('seas_type', {
        type: 'string',
        description: 'Season type (REG, POST, PRE)'
      })
      .option('no_proxy', {
        type: 'boolean',
        description: 'Disable proxy usage',
        default: false
      })
      .option('force', {
        type: 'boolean',
        description: 'Re-import games that already have matchup rows',
        default: false
      }).argv

    await import_matchup_stats_charting({
      year: argv.year,
      week: argv.week,
      esbid: argv.esbid,
      dry: argv.dry,
      proxy_pool: argv.proxy_pool,
      use_proxy: !argv.no_proxy,
      request_delay: argv.request_delay,
      seas_type: argv.seas_type,
      force: argv.force
    })
  } catch (err) {
    error = err
    console.error(error)
  }

  await report_job({
    job_type: job_types.IMPORT_MATCHUP_STATS_CHARTING,
    error
  })

  // Carry the outcome in the exit code as well as the ledger. A bare
  // process.exit() is 0, so a failed run reported as a failure to the runs
  // primitive still told the shell -- and any wrapper reading it -- that it
  // succeeded.
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_matchup_stats_charting
