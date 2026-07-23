import debug from 'debug'
import diff from 'deep-diff'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season, fantasy_positions } from '#constants'
import { is_main, report_job } from '#libs-server'
import * as pfr from '#private/libs-server/pro-football-reference.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('year', { type: 'number', describe: 'NFL season year' })
    .option('ignore_cache', {
      type: 'boolean',
      describe: 'Bypass cache and fetch fresh data'
    })
    .option('cache_max_age', {
      type: 'string',
      describe:
        'Maximum cache age (e.g., 7d, 24h, 30m). Stale entries are re-fetched.'
    }).argv
}

const log = debug('audit-player-gamelogs')
debug.enable('audit-player-gamelogs,pro-football-reference')

const format_gamelog = ({
  passing_attempts = 0,
  passing_completions = 0,
  passing_yards = 0,
  passing_interceptions = 0,
  passing_touchdowns = 0,

  rushing_attempts = 0,
  rushing_yards = 0,
  rushing_touchdowns = 0,
  fumbles_lost = 0,

  targets = 0,
  receptions = 0,
  receiving_yards = 0,
  receiving_touchdowns = 0,

  // two_point_conversions

  punt_return_touchdowns = 0,
  kickoff_return_touchdowns = 0
}) => ({
  passing_attempts,
  passing_completions,
  passing_yards,
  passing_interceptions,
  passing_touchdowns,

  rushing_attempts,
  rushing_yards,
  rushing_touchdowns,
  fumbles_lost,

  targets,
  receptions,
  receiving_yards,
  receiving_touchdowns,

  // two_point_conversions

  punt_return_touchdowns,
  kickoff_return_touchdowns
})

const parse_duration_to_ms = (duration) => {
  if (!duration) return null
  const match = duration.match(/^(\d+)(d|h|m)$/)
  if (!match) return null
  const value = parseInt(match[1])
  const unit = match[2]
  if (unit === 'd') return value * 86400000
  if (unit === 'h') return value * 3600000
  if (unit === 'm') return value * 60000
  return null
}

const audit_player_gamelogs = async ({
  year = current_season.year,
  ignore_cache = false,
  cache_max_age_ms = null,
  collector = null
} = {}) => {
  const result = {
    gamelogs_checked: 0,
    missing_gamelogs: 0,
    discrepancies: []
  }
  // create any missing gamelogs
  await db.raw('SET statement_timeout = 0')
  let pfr_player_gamelogs_for_season = []
  try {
    pfr_player_gamelogs_for_season = await pfr.get_player_gamelogs_for_season({
      year,
      ignore_cache,
      cache_max_age_ms
    })
  } catch (error) {
    log(`PFR fetch failed: ${error.message}`)
    if (collector) {
      collector.add_error(error, { script: 'pro-football-reference', year })
    }
  }

  if (!pfr_player_gamelogs_for_season.length) {
    log(
      `WARNING: PFR returned 0 gamelogs for ${year} -- PFR may be blocked by Cloudflare or unreachable`
    )
    if (collector) {
      collector.add_warning(
        `PFR returned 0 gamelogs for ${year} -- validation skipped`,
        { year }
      )
    }
    return result
  }

  const player_gamelogs = await db('player_gamelogs')
    .select(
      'player_gamelogs.*',
      'player.pfr_player_id',
      'nfl_games.season_type as seas_type',
      'nfl_games.week'
    )
    .join('player', 'player.pid', 'player_gamelogs.pid')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.season_year', year)

  // compare pfr player gamelogs to our gamelogs
  for (const pfr_player_gamelog of pfr_player_gamelogs_for_season) {
    // TODO temporarily ignore non fantasy positions
    if (!fantasy_positions.includes(pfr_player_gamelog.pos)) {
      continue
    }

    const player_gamelog = player_gamelogs.find(
      (p) =>
        p.pfr_player_id === pfr_player_gamelog.pfr_id &&
        p.week === pfr_player_gamelog.week &&
        p.seas_type === pfr_player_gamelog.seas_type
    )

    if (!player_gamelog) {
      result.missing_gamelogs++
      log(
        `missing gamelog for ${pfr_player_gamelog.pfr_id} week ${pfr_player_gamelog.week} ${pfr_player_gamelog.seas_type}`
      )
      if (collector) {
        collector.add_warning(
          `Missing gamelog for ${pfr_player_gamelog.pfr_id} week ${pfr_player_gamelog.week}`,
          {
            pfr_id: pfr_player_gamelog.pfr_id,
            week: pfr_player_gamelog.week,
            seas_type: pfr_player_gamelog.seas_type
          }
        )
      }
      continue
    }

    result.gamelogs_checked++

    const formated_pfr_gamelog = format_gamelog(pfr_player_gamelog)
    const formated_db_gamelog = format_gamelog(player_gamelog)
    const differences = diff(formated_pfr_gamelog, formated_db_gamelog)
    if (differences && differences.length) {
      log(
        `differences for ${player_gamelog.pid} week ${player_gamelog.week} ${player_gamelog.seas_type} pfr_game_id ${pfr_player_gamelog.pfr_game_id}`
      )
      log(differences)
      result.discrepancies.push({
        pid: player_gamelog.pid,
        pfr_id: pfr_player_gamelog.pfr_id,
        week: player_gamelog.week,
        seas_type: player_gamelog.seas_type,
        differences
      })

      if (collector) {
        collector.add_warning(
          `Discrepancy for ${player_gamelog.pid} week ${player_gamelog.week}`,
          {
            pid: player_gamelog.pid,
            pfr_id: pfr_player_gamelog.pfr_id,
            week: player_gamelog.week,
            seas_type: player_gamelog.seas_type,
            differences_count: differences.length
          }
        )
      }
    }
  }

  if (collector) {
    collector.set_stats({
      gamelogs_checked: result.gamelogs_checked,
      missing_gamelogs: result.missing_gamelogs,
      discrepancies_found: result.discrepancies.length
    })
  }

  return result
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const cache_max_age_ms = parse_duration_to_ms(argv.cache_max_age)
    if (argv.cache_max_age && !cache_max_age_ms) {
      console.error(
        `Invalid cache_max_age format: "${argv.cache_max_age}" (expected e.g., 7d, 24h, 30m)`
      )
      process.exit(1)
    }
    const result = await audit_player_gamelogs({
      year: argv.year,
      ignore_cache: argv.ignore_cache,
      cache_max_age_ms
    })
    console.log(
      `=== SUMMARY === ${JSON.stringify({ script: 'audit-player-gamelogs', year: argv.year || 'current', gamelogs_checked: result.gamelogs_checked, missing_gamelogs: result.missing_gamelogs, discrepancies: result.discrepancies.length })}`
    )
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.AUDIT_PLAYER_GAMELOGS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default audit_player_gamelogs
