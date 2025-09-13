import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import fs from 'fs-extra'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import {
  is_main,
  find_player_row,
  insert_prop_markets,
  report_job
} from '#libs-server'
import {
  get_fanduel_events_v3,
  get_fanduel_event_tab_v3,
  test_fanduel_v3_connection
} from '#libs-server/fanduel-v3.mjs'
import { fanduel_session_manager } from '#libs-server/session-manager.mjs'
import {
  tabs,
  get_market_type,
  format_selection_type,
  get_player_string,
  get_market_year,
  get_selection_metric_from_selection_name
} from '#libs-server/fanduel.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fanduel-odds-v3')
debug.enable('import-fanduel-odds-v3')

const get_player_ignore_markets = [
  'COACH_OF_THE_YEAR',
  'REGULAR_SEASON_WIN_TOTALS',
  'TOTAL_POINTS_(OVER/UNDER)',
  'TO_MAKE_THE_PLAYOFFS',
  'CORRECT_SCORE',
  'ALTERNATE_HANDICAP',
  'ALTERNATE_TOTAL',
  'SUPER_BOWL_MATCHUP_-_CATAPULT',
  'SUPER_BOWL_FORECAST_-_CATAPULT',
  'HIGHEST_SCORING_GAME',
  'LOWEST_SCORING_GAME',
  'FANDUEL_WEEKLY_SPECIALS',
  'PLAYER_SEASON_RECORD',
  'ANY_TIME_TOUCHDOWN/MATCH_WINNER_DOUBLE',
  '1ST_TOUCHDOWN_/_MATCH_WINNER_DOUBLE'
]

const format_market = async ({
  fanduel_market,
  timestamp,
  event = {},
  nfl_games = []
}) => {
  let nfl_game

  if (event.name) {
    const event_name_split = event.name.split(' @ ')
    const { week, seas_type } = constants.season.calculate_week(
      dayjs(event.openDate)
    )

    nfl_game = nfl_games.find(
      (game) =>
        game.week === week &&
        game.seas_type === seas_type &&
        game.year === constants.season.year &&
        game.v === fixTeam(event_name_split[0]) &&
        game.h === fixTeam(event_name_split[1])
    )
  }

  const selections = []

  const teams = event.name ? event.name.split('@').map((p) => p.trim()) : []

  const skip_get_player = get_player_ignore_markets.includes(
    fanduel_market.marketType
  )

  const market_type = get_market_type({
    marketName: fanduel_market.marketName,
    marketType: fanduel_market.marketType
  })

  for (const runner of fanduel_market.runners) {
    let player_row

    if (!skip_get_player && runner.runnerName) {
      const name_string = get_player_string({
        marketName: fanduel_market.marketName,
        marketType: fanduel_market.marketType,
        runnerName: runner.runnerName
      })

      if (name_string) {
        const params = {
          name: name_string,
          teams,
          ignore_free_agent: true,
          ignore_retired: true
        }

        try {
          player_row = await find_player_row(params)
        } catch (err) {
          log(err)
        }

        if (!player_row) {
          const { runners, ...market_params } = fanduel_market
          log(market_params)
          log(runner)
          log(`could not find player: ${params.name} / ${params.teams}`)
        }
      }
    }

    let selection_metric_line = Number(runner.handicap) || null

    if (!selection_metric_line) {
      selection_metric_line = get_selection_metric_from_selection_name(
        runner.runnerName
      )
    }

    selections.push({
      source_id: 'FANDUEL',
      source_market_id: fanduel_market.marketId,
      source_selection_id: runner.selectionId,

      selection_pid: player_row?.pid || null,
      selection_name: runner.runnerName,
      selection_metric_line,
      selection_type: format_selection_type({
        market_type,
        selection_name: runner.runnerName
      }),
      odds_decimal:
        runner.winRunnerOdds?.trueOdds?.decimalOdds?.decimalOdds || null,
      odds_american:
        runner.winRunnerOdds?.americanDisplayOdds?.americanOdds || null
    })
  }

  return {
    market_type,

    source_id: 'FANDUEL',
    source_market_id: fanduel_market.marketId,
    source_market_name: `${fanduel_market.marketName} (${fanduel_market.marketType})`,

    esbid: nfl_game?.esbid || null,
    year:
      nfl_game?.year ||
      get_market_year({
        marketName: fanduel_market.marketName,
        source_event_name: event.name
      }) ||
      null,
    source_event_id: String(fanduel_market.eventId),
    source_event_name: event.name || null,

    open: fanduel_market.marketStatus === 'OPEN',
    live: Boolean(fanduel_market.inPlay),
    selection_count: fanduel_market.numberOfRunners,

    timestamp,
    selections
  }
}

const run_import = async ({ dry = false, write = false } = {}) => {
  log('Starting FanDuel V3 odds import')

  // Test connection first
  const connection_test = await test_fanduel_v3_connection()
  if (!connection_test.success) {
    throw new Error(
      `FanDuel V3 connection test failed: ${connection_test.error}`
    )
  }

  log(
    `FanDuel V3 connection successful - ${connection_test.events_count} events, ${connection_test.markets_count} markets available`
  )

  let nfl_games_query = db('nfl_games')

  // If esbid is provided, filter only by esbid (bypass season/week filtering)
  if (argv.esbid) {
    nfl_games_query = nfl_games_query.where('esbid', argv.esbid)
  } else {
    // Otherwise use current season filtering
    nfl_games_query = nfl_games_query
      .where('seas_type', constants.season.nfl_seas_type)
      .where('year', constants.season.year)
      .where('week', constants.season.nfl_seas_week)
  }

  const nfl_games = await nfl_games_query

  if (argv.esbid && nfl_games.length === 0) {
    log(`No NFL game found with esbid: ${argv.esbid}`)
    return 0
  }

  const timestamp = Math.round(Date.now() / 1000)
  const all_formatted_markets = []
  const all_raw_markets = []

  // Get all NFL events
  const { nfl_games_events } = await get_fanduel_events_v3()

  if (!nfl_games_events || nfl_games_events.length === 0) {
    log('No NFL events found for import')
    return 0
  }

  // Filter events by esbid if provided
  let filtered_events = nfl_games_events
  if (argv.esbid) {
    const target_game = nfl_games[0]
    const event_name_pattern = `${target_game.v} @ ${target_game.h}`

    filtered_events = nfl_games_events.filter((event) => {
      const event_name_split = event.name.split(' @ ')
      if (event_name_split.length !== 2) return false

      const visiting_team = fixTeam(event_name_split[0])
      const home_team = fixTeam(event_name_split[1])

      return visiting_team === target_game.v && home_team === target_game.h
    })

    if (filtered_events.length === 0) {
      log(
        `No FanDuel events found matching game: ${event_name_pattern} (esbid: ${argv.esbid})`
      )
      return 0
    }

    log(
      `Found ${filtered_events.length} FanDuel events matching game: ${event_name_pattern} (esbid: ${argv.esbid})`
    )
  } else {
    log(`Found ${filtered_events.length} NFL events to process`)
  }

  // Process each event and tab combination
  for (const event_data of filtered_events) {
    log(`Processing event: ${event_data.name} (${event_data.eventId})`)

    // Proactive session refresh check before processing each event
    await fanduel_session_manager.ensure_fresh_session()

    for (const tab_name of tabs) {
      log(`Processing tab: ${tab_name} for event ${event_data.eventId}`)

      try {
        const tab_data = await get_fanduel_event_tab_v3({
          event_id: event_data.eventId,
          tab_name
        })

        if (!tab_data?.attachments?.markets) {
          log(
            `No markets found in tab ${tab_name} for event ${event_data.eventId}`
          )
          continue
        }

        const tab_markets = Object.values(tab_data.attachments.markets)

        for (const market_data of tab_markets) {
          // Save raw market data for file export
          all_raw_markets.push(market_data)

          try {
            const formatted_market = await format_market({
              fanduel_market: market_data,
              timestamp,
              event: event_data,
              nfl_games
            })

            if (
              formatted_market &&
              formatted_market.selections &&
              formatted_market.selections.length > 0
            ) {
              all_formatted_markets.push(formatted_market)
            }
          } catch (error) {
            log(
              `Error formatting market ${market_data.marketId}: ${error.message}`
            )
          }
        }
      } catch (error) {
        log(
          `Error processing tab ${tab_name} for event ${event_data.eventId}: ${error.message}`
        )
      }
    }
  }

  log(`Processed ${all_formatted_markets.length} total markets`)

  // Write data to files if requested
  if (write) {
    // Ensure tmp directory exists
    await fs.ensureDir('./tmp')

    const write_timestamp = Math.round(Date.now() / 1000)

    // Write raw markets
    const raw_pathname = `./tmp/fanduel-v3-markets-raw-${write_timestamp}.json`
    await fs.writeFile(raw_pathname, JSON.stringify(all_raw_markets, null, 2))
    log(`Wrote ${all_raw_markets.length} raw markets to ${raw_pathname}`)

    // Write formatted markets
    const formatted_pathname = `./tmp/fanduel-v3-markets-formatted-${write_timestamp}.json`
    await fs.writeFile(
      formatted_pathname,
      JSON.stringify(all_formatted_markets, null, 2)
    )
    log(
      `Wrote ${all_formatted_markets.length} formatted markets to ${formatted_pathname}`
    )
  }

  // Insert to database unless dry run
  if (all_formatted_markets.length > 0 && !dry) {
    await insert_prop_markets(all_formatted_markets)
    log('Successfully inserted markets into database')
  }

  return all_formatted_markets.length
}

const main = async () => {
  let market_count = 0

  try {
    market_count = await run_import({
      dry: argv.dry,
      write: argv.write
    })
  } catch (error) {
    log(`Error during import: ${error.message}`)
    console.error(error)
    process.exit(1)
  }

  log(`FanDuel V3 import completed successfully with ${market_count} markets`)

  if (!argv.dry) {
    await report_job({
      job_type: job_types.FANDUEL_ODDS_V3,
      market_count
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
