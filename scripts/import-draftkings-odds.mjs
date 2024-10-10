import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'
import dayjs from 'dayjs'

import db from '#db'
import { constants, fixTeam, bookmaker_constants } from '#libs-shared'
import {
  is_main,
  getPlayer,
  draftkings,
  insert_prop_markets,
  wait,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-draft-kings')
debug.enable(
  'import-draft-kings,get-player,draftkings,insert-prop-market,insert-prop-market-selections'
)

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
    const { week, seas_type } = constants.season.calculate_week(
      dayjs(event.startDate)
    )
    nfl_game = nfl_games.find(
      (game) =>
        game.week === week &&
        game.seas_type === seas_type &&
        game.year === constants.season.year &&
        game.v === fixTeam(event.teamShortName1) &&
        game.h === fixTeam(event.teamShortName2)
    )
  }

  const market_type = draftkings.get_market_type({
    offerCategoryId: offer_category.offerCategoryId,
    subcategoryId: offer_sub_category.subcategoryId,
    betOfferTypeId: draftkings_market.betOfferTypeId
  })

  const is_game_spread =
    market_type === bookmaker_constants.team_game_market_types.GAME_SPREAD

  for (const outcome of draftkings_market.outcomes) {
    if (outcome.hidden && !outcome.oddsDecimal) {
      continue
    }

    let player_row

    const is_player =
      outcome.participantType === 'Player' ||
      (outcome.participants &&
        outcome.participants.length === 1 &&
        outcome.participants[0].type === 'Player')

    const player_name = is_player ? outcome.participant : null
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

    let team
    if (outcome.participantType === 'Team') {
      team = draftkings.get_team_from_participant({
        participant: outcome.participant,
        participantType: outcome.participantType
      })
    }

    let selection_pid = player_row?.pid || team || null

    if (is_game_spread && outcome.label) {
      try {
        const team_abbr = outcome.label.split(' ')[1]
        if (team_abbr) {
          selection_pid = fixTeam(team_abbr)
        }
      } catch (err) {
        log(err)
      }
    }

    let selection_metric_line = outcome.line

    if (!selection_metric_line && outcome.label) {
      const parsed_line = outcome.label.match(/(\d+\.?\d*)+/)
      if (parsed_line) {
        selection_metric_line = Number(parsed_line[0])
      }
    }

    selections.push({
      source_id: 'DRAFTKINGS',
      source_market_id: draftkings_market.providerOfferId,
      source_selection_id: outcome.providerOutcomeId,

      selection_pid,
      selection_name: outcome.label,
      selection_type: draftkings.format_selection_type(outcome.label),
      selection_metric_line,
      odds_decimal: outcome.oddsDecimal,
      odds_american: outcome.oddsAmerican
    })
  }

  return {
    market_type,

    source_id: 'DRAFTKINGS',
    source_market_id: draftkings_market.providerOfferId,
    source_market_name: `${offer_category.name} - ${offer_sub_category.name} - ${draftkings_market.label} (categoryId: ${offer_category.offerCategoryId}, subcategoryId: ${offer_sub_category.subcategoryId}, betOfferTypeId: ${draftkings_market.betOfferTypeId}))`,

    esbid: nfl_game ? nfl_game.esbid : null,
    year: nfl_game ? nfl_game.year : null,
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
    year: constants.season.year
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

  await report_job({
    job_type: job_types.DRAFTKINGS_ODDS,
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
