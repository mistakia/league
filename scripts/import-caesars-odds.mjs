import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import {
  isMain,
  getPlayer,
  caesars,
  insert_prop_markets,
  wait
} from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-caesars')
debug.enable('import-caesars,get-player,caesars,insert-prop-market')

const format_market = async ({
  caesars_market,
  timestamp,
  nfl_game,
  event
}) => {
  const selections = []
  let player_row
  let market_line

  if (caesars_market.metadata?.player) {
    const team = fixTeam(caesars_market.metadata.teamName.replaceAll('|', ''))
    const params = {
      name: caesars_market.metadata.player,
      team,
      ignore_free_agent: true,
      ignore_retired: true
    }

    try {
      player_row = await getPlayer(params)
    } catch (err) {
      log(err)
    }
  }

  if (caesars_market.line) {
    market_line = Number(caesars_market.line)
  } else if (caesars_market.metadata?.line) {
    market_line = Number(caesars_market.metadata.line)
  } else if (
    caesars_market.type === 'over-under' &&
    caesars_market.metadata?.overUnderLine
  ) {
    market_line = Number(caesars_market.metadata.overUnderLine)
  }

  let selection_counter = 0
  for (const selection of caesars_market.selections) {
    if (!selection.price) {
      continue
    }

    let selection_name = null
    let selection_line = market_line || null

    if (selection.type === 'over') {
      selection_name = 'over'
    } else if (selection.type === 'under') {
      selection_name = 'under'
    } else {
      selection_name = selection.name.replaceAll('|', '')
      const alt_line_regex = /^\d+\+$/
      const is_alt_line = alt_line_regex.test(selection_name)

      if (!selection_line && is_alt_line) {
        selection_line = Number(selection_name.replace('+', '')) - 0.5
        selection_name = 'over'
      }

      if (caesars_market.type === 'two-way-handicap') {
        if (selection_counter === 0) {
          selection_line = -market_line
        } else if (selection_counter === 1) {
          selection_line = market_line
        }
        selection_counter++
      }
    }

    // if (!player_row) {
    //   try {
    //     player_row = await getPlayer({
    //       name: selection.name.replaceAll('|', ''),
    //       ignore_free_agent: true,
    //       ignore_retired: true
    //     })
    //   } catch (err) {
    //     log(err)
    //   }
    // }

    selections.push({
      source_id: 'CAESARS',
      source_market_id: caesars_market.id,
      source_selection_id: selection.id,

      selection_pid: player_row?.pid || null,
      selection_name,
      selection_metric_line: selection_line,
      odds_decimal: selection.price.d,
      odds_american: selection.price.a
    })
  }

  return {
    market_type: null, // TODO use marketCategrory and templateName to determine market_type

    source_id: 'CAESARS',
    source_market_id: caesars_market.id,
    source_market_name: `${event?.name.replaceAll(
      '|',
      ''
    )} - ${caesars_market.name.replaceAll(
      '|',
      ''
    )} — ${caesars_market.templateName.replaceAll('|', '')} — ${
      caesars_market.metadata?.marketCategory || ''
    }`,

    esbid: nfl_game?.esbid || null,
    source_event_id: event?.id || null,
    source_event_name: event?.name.replaceAll('|', '') || null,

    open: caesars_market.active,
    live: null,
    selection_count: caesars_market.selections.length,

    timestamp,
    selections
  }
}

const run = async () => {
  console.time('import-caesars-odds')

  const timestamp = Math.round(Date.now() / 1000)

  const missing = []
  const formatted_markets = []
  const all_markets = []

  const futures = await caesars.get_futures()

  if (futures && futures.competitions && futures.competitions.length) {
    for (const event of futures.competitions[0].events) {
      for (const market of event.markets) {
        all_markets.push(market)
        formatted_markets.push(
          await format_market({ caesars_market: market, timestamp, event })
        )
      }
    }
  }

  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  const schedule = await caesars.get_schedule()
  const { events } = schedule.competitions[0]

  log(`Getting odds for ${events.length} events`)

  for (const event of events) {
    console.time(`caesars-event-${event.id}`)
    const event_odds = await caesars.get_event(event.id)

    let nfl_game = null

    if (event?.type === 'MATCH') {
      if (!event.name.includes('|at|')) {
        log(`Could not parse event name: ${event.name}`)
      } else {
        try {
          const event_name_split = event.name.replaceAll('|', '').split(' at ')
          const event_date = dayjs(event.startTime).format('YYYY-MM-DD')
          nfl_game = nfl_games.find(
            (game) =>
              game.date === event_date &&
              game.year === constants.season.year &&
              game.v === fixTeam(event_name_split[0]) &&
              game.h === fixTeam(event_name_split[1])
          )
        } catch (err) {
          log(err)
          log('Could not find game for event', event.name)
        }
      }
    }

    for (const market of event_odds.markets) {
      all_markets.push(market)
      formatted_markets.push(
        await format_market({
          caesars_market: market,
          timestamp,
          nfl_game,
          event
        })
      )
    }

    await wait(10000)

    console.timeEnd(`caesars-event-${event.id}`)
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) => log(`could not find player: ${m.name} / ${m.team}`))

  if (argv.write) {
    await fs.writeFile(
      `./tmp/caesars-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
  }

  if (argv.dry) {
    log(formatted_markets[0])
    console.timeEnd('import-caesars-odds')
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets into database`)
    await insert_prop_markets(formatted_markets)
  }

  console.timeEnd('import-caesars-odds')
}

export const job = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.CAESARS_ODDS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })
}

const main = async () => {
  await job()
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
