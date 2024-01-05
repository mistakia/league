import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'
import dayjs from 'dayjs'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import {
  isMain,
  getPlayer,
  draftkings,
  insert_prop_markets,
  wait
} from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-draft-kings')
debug.enable('import-draft-kings,get-player,draftkings,insert-prop-market')

const format_market = async ({
  draftkings_market,
  offer_category,
  offer_sub_category,
  timestamp,
  nfl_games = [],
  draftkings_events = []
}) => {
  let nfl_game
  const selections = []

  const event = draftkings_events.find(
    (e) => e.eventId === draftkings_market.eventId
  )

  const teams =
    event && event.teamShortName1 && event.teamShortName2
      ? [fixTeam(event.teamShortName1), fixTeam(event.teamShortName2)]
      : []

  if (event && event.teamShortName1 && event.teamShortName2) {
    const week = dayjs(event.startDate).diff(constants.season.start, 'weeks')
    nfl_game = nfl_games.find(
      (game) =>
        game.week === week &&
        game.year === constants.season.year &&
        game.v === fixTeam(event.teamShortName1) &&
        game.h === fixTeam(event.teamShortName2)
    )
  }

  for (const outcome of draftkings_market.outcomes) {
    let player_row

    const player_name =
      outcome.participantType === 'Player' ? outcome.participant : null
    if (player_name) {
      const params = {
        name: player_name,
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
        const { outcomes, ...market_params } = draftkings_market
        log(event)
        log(market_params)
        log(outcome)
        log(`could not find player: ${params.name} / ${params.teams}`)
      }
    }

    selections.push({
      source_id: 'DRAFTKINGS',
      source_market_id: draftkings_market.providerOfferId,
      source_selection_id: outcome.providerOutcomeId,

      selection_pid: player_row?.pid || null,
      selection_name: outcome.label,
      selection_metric_line: outcome.line,
      odds_decimal: outcome.oddsDecimal,
      odds_american: outcome.oddsAmerican
    })
  }

  return {
    market_type: draftkings.get_market_type({
      offerCategoryId: offer_category.offerCategoryId,
      subcategoryId: offer_sub_category.subcategoryId
    }),

    source_id: 'DRAFTKINGS',
    source_market_id: draftkings_market.providerOfferId,
    source_market_name: `${offer_category.name} - ${offer_sub_category.name} - ${draftkings_market.label} (categoryId: ${offer_category.offerCategoryId}, subcategoryId: ${offer_sub_category.subcategoryId}))`,

    esbid: nfl_game ? nfl_game.esbid : null,
    source_event_id: draftkings_market.eventId,
    source_event_name: event?.name || null,

    open: draftkings_market.isOpen,
    live: null,
    selection_count: draftkings_market.outcomes.length,

    timestamp,
    selections
  }
}

const run = async () => {
  console.time('import-draft-kings')

  const timestamp = Math.round(Date.now() / 1000)
  const formatted_markets = []
  const all_markets = []

  const nfl_games = await db('nfl_games').where({
    week: constants.season.nfl_seas_week,
    year: constants.season.year,
    seas_type: constants.season.nfl_seas_type
  })

  const offers = await draftkings.get_eventgroup_offer_categories()
  for (const offer_category of offers) {
    const { offerCategoryId } = offer_category
    const offer_subcategories =
      await draftkings.get_eventgroup_offer_subcategories({ offerCategoryId })
    for (const offer_sub_category of offer_subcategories) {
      const { subcategoryId } = offer_sub_category
      const { offers, events } = await draftkings.get_offers({
        offerCategoryId,
        subcategoryId
      })

      if (!offers) {
        continue
      }

      for (const offer of offers) {
        all_markets.push(offer)
        formatted_markets.push(
          await format_market({
            draftkings_market: offer,
            offer_category,
            offer_sub_category,
            timestamp,
            draftkings_events: events,
            nfl_games
          })
        )
      }

      await wait(3000)
    }
  }

  if (argv.write) {
    await fs.writeFile(
      `./tmp/draftking-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
    return
  }

  if (argv.dry) {
    log(formatted_markets[0])
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets into database`)
    await insert_prop_markets(formatted_markets)
  }

  console.timeEnd('import-draft-kings')
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
    type: constants.jobs.DRAFTKINGS_ODDS,
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
