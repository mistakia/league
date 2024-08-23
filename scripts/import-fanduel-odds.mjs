import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import fs from 'fs-extra'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, team_aliases, fixTeam } from '#libs-shared'
import {
  isMain,
  getPlayer,
  fanduel,
  insert_prop_markets,
  wait,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fanduel')
debug.enable('import-fanduel,get-player,fanduel,insert-prop-market')

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

  const teams = event.name
    ? event.name.split('@').map((p) => team_aliases[p.trim()])
    : []

  const skip_get_player = get_player_ignore_markets.includes(
    fanduel_market.marketType
  )

  for (const runner of fanduel_market.runners) {
    let player_row

    if (!skip_get_player && runner.runnerName) {
      const name_string = fanduel.get_player_string({
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
          player_row = await getPlayer(params)
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
      selection_metric_line = fanduel.get_selection_metric_from_selection_name(
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
      odds_decimal:
        runner.winRunnerOdds?.trueOdds?.decimalOdds.decimalOdds || null,
      odds_american:
        runner.winRunnerOdds?.americanDisplayOdds?.americanOddsInt || null
    })
  }

  return {
    market_type: fanduel.get_market_type({
      marketName: fanduel_market.marketName,
      marketType: fanduel_market.marketType
    }),

    source_id: 'FANDUEL',
    source_market_id: fanduel_market.marketId,
    source_market_name: `${fanduel_market.marketName} (${fanduel_market.marketType})`,

    esbid: nfl_game?.esbid || null,
    year:
      nfl_game?.year ||
      fanduel.get_market_year({
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

const run = async ({ dry = false }) => {
  console.time('import-fanduel-odds')

  const timestamp = Math.round(Date.now() / 1000)
  const { nfl_games_events, markets } = await fanduel.getEvents()

  // write markets object to file
  if (argv.write) {
    await fs.writeFile(
      `./tmp/fanduel-markets-${timestamp}.json`,
      JSON.stringify(markets, null, 2)
    )
  }

  const formatted_markets = []
  for (const fanduel_market of markets) {
    const formatted_market = await format_market({
      fanduel_market,
      timestamp
    })
    formatted_markets.push(formatted_market)
  }

  if (formatted_markets.length && !dry) {
    log(`inserting ${formatted_markets.length} markets`)
    await insert_prop_markets(formatted_markets)
  }

  // do not pull in nfl_game_event props outside of the NFL season
  if (
    !constants.season.now.isBetween(
      constants.season.start,
      constants.season.end
    )
  ) {
    console.timeEnd('import-fanduel-odds')
    return
  }

  const all_event_markets = []
  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  // filter events to those for current week
  const current_week_events = nfl_games_events.filter(
    (event) => event.name !== 'NFL Matches' && event.name !== 'NFL'
  )

  log(`Getting odds for ${current_week_events.length} events`)

  const formatted_event_markets = []
  for (const event of current_week_events) {
    console.time(`fanduel-event-${event.eventId}`)
    for (const tab of fanduel.tabs) {
      const data = await fanduel.getEventTab({ eventId: event.eventId, tab })

      for (const fanduel_market of Object.values(data.attachments.markets)) {
        const formatted_market = await format_market({
          fanduel_market,
          timestamp,
          event,
          nfl_games
        })
        formatted_event_markets.push(formatted_market)
        all_event_markets.push(fanduel_market)
      }

      await wait(3000)
    }
    console.timeEnd(`fanduel-event-${event.eventId}`)
  }

  // write markets object to file
  if (argv.write) {
    await fs.writeFile(
      `./tmp/fanduel-event-markets-${timestamp}.json`,
      JSON.stringify(all_event_markets, null, 2)
    )

    await fs.writeFile(
      `./tmp/fanduel-event-markets-formatted-${timestamp}.json`,
      JSON.stringify(formatted_event_markets, null, 2)
    )
  }

  /* const weekly_specials_markets = await fanduel.getWeeklySpecials()
   * for (const market of weekly_specials_markets) {
   *   await handle_leader_market({ market })
   * }
   */

  if (dry) {
    log(formatted_event_markets[0])
    return
  }

  if (formatted_event_markets.length) {
    log(`Inserting ${formatted_event_markets.length} markets into database`)
    await insert_prop_markets(formatted_event_markets)
  }

  console.timeEnd('import-fanduel-odds')
}

export const job = async () => {
  let error
  try {
    await run({
      dry: argv.dry
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  if (!argv.dry) {
    await report_job({
      job_type: job_types.FANDUEL_ODDS,
      error
    })
  }
}

const main = async () => {
  await job()
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
