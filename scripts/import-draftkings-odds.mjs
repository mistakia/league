import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#common'
import {
  isMain,
  getPlayer,
  draftkings,
  insertProps,
  insert_prop_markets
} from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-draft-kings')
debug.enable('import-draft-kings,get-player,draftkings,insert-prop-market')

const run = async () => {
  console.time('import-draft-kings')

  const timestamp = Math.round(Date.now() / 1000)
  const missing = []
  const props = []
  const formatted_markets = []

  const nfl_games = await db('nfl_games').where({
    week: constants.season.nfl_seas_week,
    year: constants.season.year,
    seas_type: constants.season.nfl_seas_type
  })

  const handle_over_under_market = async ({ offer, category, teams }) => {
    let player_row
    const params = { name: offer.outcomes[0].participant, teams }
    try {
      player_row = await getPlayer(params)
    } catch (err) {
      log(err)
    }

    if (!player_row) {
      missing.push(params)
      return
    }

    const nfl_game = nfl_games.find(
      (game) => game.v === player_row.cteam || game.h === player_row.cteam
    )

    if (!nfl_game) {
      return
    }

    const prop = {}
    prop.pid = player_row.pid
    prop.prop_type = category.type
    prop.id = offer.providerOfferId
    prop.timestamp = timestamp
    prop.week = constants.season.week
    prop.year = constants.season.year
    prop.esbid = nfl_game.esbid
    prop.sourceid = constants.sources.DRAFT_KINGS_VA
    prop.active = Boolean(offer.isOpen)
    prop.live = false

    prop.ln = parseFloat(offer.outcomes[0].line, 10)

    for (const outcome of offer.outcomes) {
      if (outcome.label === 'Over') {
        prop.o = Number(outcome.oddsDecimal)
        prop.o_am = Number(outcome.oddsAmerican)
      } else if (outcome.label === 'Under') {
        prop.u = Number(outcome.oddsDecimal)
        prop.u_am = Number(outcome.oddsAmerican)
      }
    }
    props.push(prop)
  }

  const handle_leader_market = async ({
    offer,
    category,
    teams,
    line = null
  }) => {
    for (const outcome of offer.outcomes) {
      let player_row
      const params = { name: outcome.participant || outcome.label, teams }
      try {
        player_row = await getPlayer(params)
      } catch (err) {
        log(err)
      }

      if (!player_row) {
        missing.push(params)
        continue
      }

      const nfl_game = nfl_games.find(
        (game) => game.v === player_row.cteam || game.h === player_row.cteam
      )

      if (!nfl_game) {
        continue
      }

      const prop = {}
      prop.pid = player_row.pid
      prop.prop_type = category.type
      prop.id = offer.providerOfferId
      prop.timestamp = timestamp
      prop.week = constants.season.week
      prop.year = constants.season.year
      prop.esbid = nfl_game.esbid
      prop.sourceid = constants.sources.DRAFT_KINGS_VA
      prop.active = Boolean(offer.isOpen)
      prop.live = false

      prop.ln = line
      prop.o = Number(outcome.oddsDecimal)
      prop.o_am = Number(outcome.oddsAmerican)

      prop.u = null
      prop.u_am = null

      props.push(prop)
    }
  }

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
        formatted_markets.push({
          market_id: `${offer_category.offerCategoryId}/${subcategoryId}/${offer.providerOfferId}`,
          source_id: constants.sources.DRAFT_KINGS_VA,
          source_event_id: offer.eventId,
          source_market_name: offer.label,
          market_name: `${offer_category.name} - ${offer_sub_category.name} - ${offer.label}`,
          open: offer.isOpen,
          live: false,
          runners: offer.outcomes.length,
          market_type: null,
          timestamp
        })

        // do not pull in props outside of the NFL season
        if (
          !constants.season.now.isBetween(
            constants.season.start,
            constants.season.end
          )
        ) {
          continue
        }

        // check if this is a tracked market
        const tracked_category = draftkings.categories.find(
          (c) =>
            c.subcategoryId === subcategoryId &&
            c.offerCategoryId === offer_category.offerCategoryId
        )
        if (!tracked_category) {
          continue
        }

        const event = events.find((e) => e.eventId === offer.eventId)
        const teams = event
          ? [fixTeam(event.teamShortName1), fixTeam(event.teamShortName2)]
          : []

        if (
          tracked_category.type ===
          constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS
        ) {
          const line = 0.5
          await handle_leader_market({
            offer,
            category: tracked_category,
            teams,
            line
          })
        } else {
          const is_leader_market = constants.player_prop_types_leaders.includes(
            tracked_category.type
          )
          if (is_leader_market) {
            await handle_leader_market({
              offer,
              category: tracked_category,
              teams
            })
          } else {
            await handle_over_under_market({
              offer,
              category: tracked_category,
              teams
            })
          }
        }
      }
    }
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) => log(`could not find player: ${m.name} / ${m.teams}`))

  if (argv.dry) {
    log(props[0])
    return
  }

  if (props.length) {
    log(`Inserting ${props.length} props into database`)
    await insertProps(props)
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
