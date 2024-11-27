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
  wait,
  report_job,
  fanatics
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  player_game_alt_prop_types,
  player_game_prop_types,
  team_game_market_types
} from '#libs-shared/bookmaker-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fanatics-odds')
debug.enable('import-fanatics-odds,get-player,insert-prop-market,fanatics')

const format_market = async ({
  market,
  timestamp,
  event = {},
  nfl_games = []
}) => {
  let nfl_game

  if (event.name) {
    const home_team = event.participants.find((p) => p.position === 0)?.name
    const away_team = event.participants.find((p) => p.position === 1)?.name

    const { week, seas_type } = constants.season.calculate_week(
      dayjs(event.eventTime)
    )

    nfl_game = nfl_games.find(
      (game) =>
        game.week === week &&
        game.seas_type === seas_type &&
        game.year === constants.season.year &&
        game.v === fixTeam(away_team) &&
        game.h === fixTeam(home_team)
    )
  }

  const market_type = fanatics.format_market_type({ market_type: market.type })
  const is_game_spread = market_type === team_game_market_types.GAME_SPREAD
  const selections = []
  const teams = nfl_game ? [nfl_game.h, nfl_game.v] : []
  const use_selection_name = [
    player_game_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS,
    player_game_prop_types.GAME_FIRST_TOUCHDOWN_SCORER,
    player_game_prop_types.GAME_LAST_TOUCHDOWN_SCORER
  ].includes(market_type)

  for (const selection of market.selection) {
    let player_row
    let player_name = selection.participantInfo?.[0]?.name

    if (!player_name && use_selection_name) {
      player_name = selection.name
    }

    if (player_name) {
      try {
        player_row = await find_player_row({
          name: player_name,
          teams,
          ignore_free_agent: true,
          ignore_retired: true
        })
      } catch (err) {
        log(err)
      }
    }

    const metric_line = is_game_spread
      ? format_metric_line(selection.name)
      : market.line || format_metric_line(selection.type)
    const is_player_alt_prop = player_game_alt_prop_types[market_type]
    const selection_type = is_player_alt_prop
      ? 'OVER'
      : format_selection_type(selection.type)

    selections.push({
      source_id: 'FANATICS',
      source_market_id: market.id,
      source_selection_id: selection.id,
      selection_pid: player_row?.pid || null,
      selection_name: selection.name,
      selection_type,
      selection_metric_line: metric_line,
      odds_decimal: selection.decimalOdds || null,
      odds_american: selection.moneylineOdds || null
    })
  }

  return {
    market_type,
    source_id: 'FANATICS',
    source_market_id: market.id,
    source_market_name: market.name,
    esbid: nfl_game?.esbid || null,
    year: nfl_game?.year || constants.season.year,
    source_event_id: String(event.id),
    source_event_name: event.name,
    open: market.state === 'OPEN',
    live: Boolean(market.live),
    selection_count: market.selection.length,
    timestamp,
    selections
  }
}

const format_metric_line = (selection_type) => {
  const match = selection_type.match(/([+-])?(\d+\.?\d*)\+?$/)
  if (!match) return null
  const value = Number(match[2])
  return match[1] === '-' ? -value : value
}

const format_selection_type = (selection_type) => {
  if (!selection_type) return null

  const type = selection_type.toLowerCase()
  if (/\bover\b/.test(type)) return 'OVER'
  if (/\bunder\b/.test(type)) return 'UNDER'
  if (/\byes\b/.test(type)) return 'YES'
  if (/\bno\b/.test(type)) return 'NO'
  return null
}

const run = async ({
  dry_run = false,
  ignore_cache = false,
  write = false
}) => {
  console.time('import-fanatics-odds')

  const missing_markets = new Set()

  const timestamp = Math.round(Date.now() / 1000)
  const league_info = await fanatics.get_league_info({ ignore_cache })

  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  const formatted_markets = []
  const raw_markets = []

  // Filter events to those for current week
  const event_cards = league_info.cardPack.cards.filter(
    (card) => card.type === 'EVENT_CHIP_CONTAINER' && card.data?.event
  )

  const fanatics_events = event_cards.reduce((events, card) => {
    const event = card.data.event
    if (!events.some((e) => e.id === event.id)) {
      events.push(event)
    }
    return events
  }, [])

  log(`Getting odds for ${fanatics_events.length} events`)

  for (const event of fanatics_events) {
    console.time(`fanatics-event-${event.id}`)

    const event_info = await fanatics.get_event_info({
      event_id: event.id,
      ignore_cache
    })

    for (const card of event_info.cardPack.cards) {
      for (const market of card.markets) {
        // Only track markets that don't have a formatted type
        const market_type = fanatics.format_market_type({
          market_type: market.type
        })
        if (!market_type) {
          missing_markets.add(`${market.type} - ${market.name}`)
        }

        raw_markets.push(market)

        const formatted_market = await format_market({
          market,
          timestamp,
          event,
          nfl_games
        })

        formatted_markets.push(formatted_market)
      }
    }

    await wait(3000)
    console.timeEnd(`fanatics-event-${event.id}`)
  }

  if (missing_markets.size) {
    console.log('\nMissing Market Types:')
    console.log([...missing_markets].sort().join('\n'))
  }

  if (write) {
    await fs.writeFile(
      `./tmp/fanatics-markets-${timestamp}.json`,
      JSON.stringify(raw_markets, null, 2)
    )

    await fs.writeFile(
      `./tmp/fanatics-markets-formatted-${timestamp}.json`,
      JSON.stringify(formatted_markets, null, 2)
    )
  }

  if (dry_run) {
    log(formatted_markets[0])
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets into database`)
    await insert_prop_markets(formatted_markets)
  }

  console.timeEnd('import-fanatics-odds')
}

export const job = async () => {
  let error
  try {
    await run({
      dry_run: argv.dry,
      ignore_cache: argv.ignore_cache,
      write: argv.write
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  if (!argv.dry) {
    await report_job({
      job_type: job_types.FANATICS_ODDS,
      error
    })
  }
}

const main = async () => {
  await job()
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
