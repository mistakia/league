import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import {
  isMain,
  insert_prop_markets,
  betrivers,
  wait,
  getPlayer
} from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-betrivers-odds')
debug.enable('import-betrivers-odds,insert-prop-market')

const format_market = async ({
  betrivers_market,
  timestamp,
  event,
  nfl_game
}) => {
  const selections = []
  let player_row

  if (betrivers_market.participant) {
    const params = {
      name: betrivers_market.participant,
      teams: nfl_game ? [nfl_game.v, nfl_game.h] : []
    }

    try {
      player_row = await getPlayer(params)
    } catch (err) {
      log(err)
    }
  }

  for (const outcome of betrivers_market.outcomes) {
    let selection_name = null

    if (outcome.label === 'Over') {
      selection_name = 'over'
    } else if (outcome.label === 'Under') {
      selection_name = 'under'
    } else {
      selection_name = outcome.label
    }

    const selection_metric_line = Number(outcome.line) || null

    selections.push({
      source_id: 'BETRIVERS',
      source_market_id: betrivers_market.id,
      source_selection_id: outcome.id,

      selection_pid: player_row?.pid || null,
      selection_name,
      selection_metric_line,
      odds_decimal: Number(outcome.odds),
      odds_american: Number(outcome.oddsAmerican)
    })
  }

  return {
    market_type: null, // TODO use betDescription and betOfferType

    source_id: 'BETRIVERS',
    source_market_id: betrivers_market.id,
    source_market_name: `${betrivers_market.betDescription} - (${betrivers_market.betOfferType})`,

    esbid: nfl_game?.esbid || null,
    source_event_id: event?.id,
    source_event_name: event?.name,

    open: betrivers_market.status === 'OPEN',
    live: null,
    selection_count: betrivers_market.outcomes.length,

    timestamp,
    selections
  }
}

const import_betrivers_odds = async () => {
  const formatted_markets = []
  const all_markets = []
  const timestamp = Math.round(Date.now() / 1000)

  const nfl_games = await db('nfl_games').where({
    week: constants.season.nfl_seas_week,
    year: constants.season.year,
    seas_type: constants.season.nfl_seas_type
  })

  const market_groups = await betrivers.get_market_groups()
  for (const market_group of market_groups) {
    const group_events = await betrivers.get_group_events(market_group.id)
    for (const event of group_events) {
      let nfl_game = null

      if (event && event.format === 'MATCH') {
        const visitor = fixTeam(event.extendedFormatName[0])
        const home = fixTeam(event.extendedFormatName[2])
        const week = dayjs(event.start).diff(constants.season.start, 'weeks')

        nfl_game = nfl_games.find(
          (game) =>
            game.week === week &&
            game.year === constants.season.year &&
            game.v === visitor &&
            game.h === home
        )
      }

      if (event.betOffers.length !== event.offerCount) {
        const event_markets = await betrivers.get_event_markets(event.id)
        for (const offering_group of event_markets.offeringGroups) {
          for (const criterion_group of offering_group.criterionGroups) {
            for (const offer of criterion_group.betOffers) {
              all_markets.push(offer)
              formatted_markets.push(
                await format_market({
                  betrivers_market: offer,
                  timestamp,
                  event,
                  nfl_game
                })
              )
            }
          }
        }
      } else {
        for (const offer of event.betOffers) {
          all_markets.push(offer)
          formatted_markets.push(
            await format_market({
              betrivers_market: offer,
              timestamp,
              event,
              nfl_game
            })
          )
        }
      }
    }

    await wait(2500)
  }

  if (argv.write) {
    await fs.writeFile(
      `./tmp/betrivers-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
    return
  }

  if (argv.dry) {
    log(formatted_markets[0])
    return
  }

  if (formatted_markets.length) {
    log(`inserting ${formatted_markets.length} markets`)
    await insert_prop_markets(formatted_markets)
  }
}

export const job = async () => {
  let error
  try {
    await import_betrivers_odds()
  } catch (err) {
    error = err
    log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.BETRIVERS_ODDS,
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

export default import_betrivers_odds
