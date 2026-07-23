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

const log = debug('import-matchup-stats-charting')

async function get_games_for_import({ year, week, esbid, seas_type }) {
  const query = db('nfl_games')
    .select(
      'esbid',
      'shieldid',
      'season_year as year',
      'week',
      'season_type as seas_type',
      'h',
      'v'
    )
    .whereNotNull('shieldid')

  if (esbid) {
    query.where('esbid', esbid)
  } else {
    query.where('season_year', year)
    if (week) {
      query.where('week', week)
    }
    if (seas_type) {
      query.where('season_type', seas_type)
    }
  }

  query.orderBy(['season_year', 'week', 'esbid'])
  return query
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
  const { esbid, shieldid, week } = game

  log(
    `processing matchup stats for game ${esbid} (shield: ${shieldid}, week ${week})`
  )

  let matchup_data
  try {
    matchup_data = await client.get_matchup_stats({ game_id: shieldid })
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
      position: matchup.offensePlayerPosition
    })

    const defense_pid = await match_charting_player({
      sumer_player_id: matchup.defensePlayerId,
      football_name: matchup.defensePlayerFootballName,
      last_name: matchup.defensePlayerLastName,
      team_code: matchup.defensePlayerTeamCode,
      jersey_number: matchup.defensePlayerJerseyNumber,
      position: matchup.defensePlayerPosition
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
  }

  stats.games_processed += 1
  stats.total_matchups_inserted += rows_to_insert.length

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
  collector = null
} = {}) {
  console.time('import-matchup-stats-charting')
  log(
    `starting charting matchup stats import: year=${year} week=${week || 'all'} esbid=${esbid || 'all'} dry=${dry}`
  )

  const client = new ChartingDataClient({
    proxy_pool,
    use_proxy,
    request_delay_ms: request_delay
  })

  // Preload player cache for matching
  await preload_active_players({ all_players: true })

  const games = await get_games_for_import({ year, week, esbid, seas_type })
  log(`found ${games.length} games to process`)

  if (games.length === 0) {
    console.timeEnd('import-matchup-stats-charting')
    return { games_processed: 0 }
  }

  const stats = {
    games_processed: 0,
    games_failed: 0,
    games_empty: 0,
    total_matchups_inserted: 0,
    players_unmatched: 0
  }

  for (const game of games) {
    await process_game({ game, client, stats, dry })
  }

  console.timeEnd('import-matchup-stats-charting')

  log('--- Import Summary ---')
  log(`games processed: ${stats.games_processed}`)
  log(`games failed: ${stats.games_failed}`)
  log(`games empty: ${stats.games_empty}`)
  log(`matchups inserted: ${stats.total_matchups_inserted}`)
  log(`players unmatched: ${stats.players_unmatched}`)

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
      }).argv

    debug.enable(
      'import-matchup-stats-charting,charting-data,charting-data:player-matching'
    )

    await import_matchup_stats_charting({
      year: argv.year,
      week: argv.week,
      esbid: argv.esbid,
      dry: argv.dry,
      proxy_pool: argv.proxy_pool,
      use_proxy: !argv.no_proxy,
      request_delay: argv.request_delay,
      seas_type: argv.seas_type
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_MATCHUP_STATS_CHARTING,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_matchup_stats_charting
