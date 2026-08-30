import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { ChartingDataClient } from '#libs-server/charting-data/index.mjs'
import {
  match_charting_player,
  extract_players_from_plays,
  extract_players_from_matchups
} from '#libs-server/charting-data/player-matching.mjs'
import { preload_active_players } from '#libs-server/player-cache.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('import-players-charting')

async function get_games_for_import({ season_year, week, esbid, season_type }) {
  const query = db('nfl_games')
    .select('esbid', 'shield_game_id', 'season_year', 'week', 'season_type')
    .whereNotNull('shield_game_id')

  if (esbid) {
    query.where('esbid', esbid)
  } else {
    query.where('season_year', season_year)
    if (week) {
      query.where('week', week)
    }
    if (season_type) {
      query.where('season_type', season_type)
    }
  }

  query.orderBy(['season_year', 'week', 'esbid'])
  return query
}

export async function import_players_charting({
  season_year = current_season.year,
  week,
  esbid,
  dry = false,
  // nfl_pro is the only sticky dedicated-ISP residential pool, and it is the
  // ONE place this default lives. The yargs option below deliberately declares
  // no `default`: it used to carry 'default' too, which silently won on every
  // CLI invocation -- meaning every cron run -- so changing this line alone
  // would have pinned nothing.
  proxy_pool = 'nfl_pro',
  request_delay = 3000,
  season_type = null,
  collector = null
} = {}) {
  console.time('import-players-charting')
  log(
    `starting charting player import: year=${season_year} week=${week || 'all'} esbid=${esbid || 'all'} dry=${dry}`
  )

  const client = new ChartingDataClient({
    proxy_pool,
    request_delay_ms: request_delay
  })

  // Preload player cache with all players for matching
  await preload_active_players({ all_players: true })

  const games = await get_games_for_import({
    season_year,
    week,
    esbid,
    season_type
  })
  log(`found ${games.length} games to process`)

  if (games.length === 0) {
    console.timeEnd('import-players-charting')
    return { games_processed: 0 }
  }

  const all_players = new Map()
  let games_processed = 0
  let games_failed = 0

  for (const game of games) {
    const { esbid: game_esbid, shield_game_id, week: game_week } = game

    log(
      `processing game ${game_esbid} (shield: ${shield_game_id}, week ${game_week})`
    )

    // Fetch plays for player extraction
    try {
      const plays_data = await client.get_plays({ game_id: shield_game_id })
      if (plays_data && Array.isArray(plays_data)) {
        const play_players = extract_players_from_plays(plays_data)
        for (const player of play_players) {
          if (!all_players.has(player.sumer_player_id)) {
            all_players.set(player.sumer_player_id, player)
          }
        }
      }
    } catch (error) {
      log(`failed to fetch plays for game ${game_esbid}: ${error.message}`)
      games_failed += 1
    }

    // Fetch matchup stats for player extraction
    try {
      const matchup_data = await client.get_matchup_stats({
        game_id: shield_game_id
      })
      if (matchup_data && Array.isArray(matchup_data)) {
        const matchup_players = extract_players_from_matchups(matchup_data)
        for (const player of matchup_players) {
          if (!all_players.has(player.sumer_player_id)) {
            all_players.set(player.sumer_player_id, player)
          }
        }
      }
    } catch (error) {
      log(
        `failed to fetch matchup stats for game ${game_esbid}: ${error.message}`
      )
    }

    games_processed += 1
  }

  log(
    `extracted ${all_players.size} unique players across ${games_processed} games`
  )

  // Match players
  let matched = 0
  let unmatched = 0
  const unmatched_players = []

  for (const [, player_info] of all_players) {
    if (dry) {
      log(
        `[dry] would match player: ${player_info.football_name} ${player_info.last_name} (${player_info.team_code})`
      )
      continue
    }

    // Scope the match to the season being imported, not to the player's team
    // today -- see libs-server/charting-data/player-matching.mjs.
    const pid = await match_charting_player({
      ...player_info,
      season_year
    })

    if (pid) {
      matched += 1
    } else {
      unmatched += 1
      unmatched_players.push(player_info)
    }
  }

  console.timeEnd('import-players-charting')

  log('--- Import Summary ---')
  log(`games processed: ${games_processed}`)
  log(`games failed: ${games_failed}`)
  log(`unique players: ${all_players.size}`)
  log(`matched: ${matched}`)
  log(`unmatched: ${unmatched}`)

  if (unmatched_players.length > 0) {
    log('--- Unmatched Players ---')
    for (const player of unmatched_players) {
      log(
        `  ${player.football_name} ${player.last_name} (${player.team_code}, #${player.jersey_number || '?'}, ${player.position || '?'}, sumer_id: ${player.sumer_player_id})`
      )
    }
  }

  return {
    games_processed,
    games_failed,
    unique_players: all_players.size,
    matched,
    unmatched,
    unmatched_players
  }
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
        description: 'Proxy pool name (default: nfl_pro)'
      })
      .option('request_delay', {
        type: 'number',
        description: 'Delay between requests (ms)',
        default: 3000
      })
      .option('seas_type', {
        type: 'string',
        // The alias is the fix, not decoration. Three of these four scripts
        // declared this option as `seas_type` and then read `argv.season_type`,
        // which yargs never set -- so --seas_type PRE parsed cleanly, was
        // dropped, and every run silently used the default scope. The alias
        // makes yargs populate BOTH keys, so neither spelling can be the wrong
        // one. Same defect class as the qtr/dwn keys find_play used to accept.
        alias: 'season_type',
        description: 'Season type (REG, POST, PRE)'
      }).argv

    enable_debug_namespaces(
      'import-players-charting,charting-data,charting-data:player-matching'
    )

    await import_players_charting({
      season_year: argv.year,
      week: argv.week,
      esbid: argv.esbid,
      dry: argv.dry,
      proxy_pool: argv.proxy_pool,
      request_delay: argv.request_delay,
      season_type: argv.season_type
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYERS_CHARTING,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_players_charting
