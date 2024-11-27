import fs from 'fs-extra'
import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import { hideBin } from 'yargs/helpers'
import oddslib from 'oddslib'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import {
  is_main,
  find_player_row,
  insert_prop_markets,
  betonline,
  wait,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv

const log = debug('import-betonline')
debug.enable('import-betonline,get-player,betonline')

const timestamp = Math.round(Date.now() / 1000)

const format_market = async ({
  betonline_market,
  timestamp,
  player_row,
  nfl_game,
  source_event_id
}) => {
  const selections = []

  selections.push({
    source_id: 'BETONLINE',
    source_market_id: betonline_market.id,
    source_selection_id: `${betonline_market.id}-over`,

    selection_pid: player_row?.pid || null,
    selection_name: 'over',
    selection_metric_line: Number(betonline_market.value) - 0.5,
    odds_decimal: Number(betonline_market.odds),
    odds_american: oddslib
      .from('decimal', betonline_market.odds)
      .to('moneyline')
  })

  return {
    market_type: null, // TODO use statistic id

    source_id: 'BETONLINE',
    source_market_id: betonline_market.id,
    source_market_name: `betonline_market.statistic.title (id: ${betonline_market.statistic.id})`,

    esbid: nfl_game?.esbid || null,
    source_event_id,
    source_event_name: null,

    open: true,
    live: null,
    selection_count: 1,

    timestamp,
    selections
  }
}

const run = async () => {
  // do not pull in reports outside of the NFL season
  if (
    !constants.season.now.isBetween(
      constants.season.start,
      constants.season.end
    )
  ) {
    log('Not during regular season')
    return
  }

  const all_markets = []
  const formatted_markets = []

  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  const market_groups = await betonline.get_market_groups()
  const events = await betonline.get_events()

  for (const event of events) {
    const gameId = event.providers.find((p) => p.name === 'nix')?.id
    if (!gameId) {
      log(`No gameId for event ${event}`)
      continue
    }

    let nfl_game
    if (
      event.team1 &&
      event.team1.length &&
      event.team2 &&
      event.team2.length
    ) {
      const { week, seas_type } = constants.season.calculate_week(
        dayjs(event.date)
      )
      const home = fixTeam(event.team1[0]?.title)
      const visitor = fixTeam(event.team2[0]?.title)
      nfl_game = nfl_games.find(
        (game) =>
          game.week === week &&
          game.seas_type === seas_type &&
          game.year === constants.season.year &&
          game.v === visitor &&
          game.h === home
      )
    }

    for (const market_group of betonline.market_groups) {
      for (const market_sub_group of market_groups[market_group]) {
        const markets = await betonline.get_markets({
          statistic: encodeURIComponent(market_sub_group),
          gameId
        })

        for (const market of markets) {
          for (const betonline_player of market.players) {
            let player_row
            const params = {
              name: betonline_player.name,
              team: fixTeam(betonline_player.team),
              ignore_free_agent: true,
              ignore_retired: true
            }

            try {
              player_row = await find_player_row(params)
            } catch (err) {
              log(err)
            }

            for (const market of betonline_player.markets) {
              all_markets.push(market)
              formatted_markets.push(
                await format_market({
                  betonline_market: market,
                  timestamp,
                  player_row,
                  nfl_game,
                  source_event_id: gameId
                })
              )
            }
          }
        }

        await wait(2500)
      }
    }
  }

  if (argv.write) {
    await fs.writeFile(
      `./tmp/betonline-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
  }

  if (argv.dry) {
    log(formatted_markets[0])
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets`)
    await insert_prop_markets(formatted_markets)
  }
}

export const job = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.BETONLINE_ODDS,
    error
  })
}

const main = async () => {
  await job()
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
