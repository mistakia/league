import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#common'
import { isMain, getPlayer, draftkings, wait, insertProps } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-draft-kings')
debug.enable('import-draft-kings,get-player,draftkings')

const run = async () => {
  // do not pull in reports outside of the NFL season
  if (
    !constants.season.now.isBetween(
      constants.season.start,
      constants.season.end
    )
  ) {
    return
  }

  const timestamp = Math.round(Date.now() / 1000)

  const missing = []
  const props = []

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

    const prop = {}
    prop.pid = player_row.pid
    prop.prop_type = category.type
    prop.id = offer.providerOfferId
    prop.timestamp = timestamp
    prop.week = constants.season.week
    prop.year = constants.season.year
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

      const prop = {}
      prop.pid = player_row.pid
      prop.prop_type = category.type
      prop.id = offer.providerOfferId
      prop.timestamp = timestamp
      prop.week = constants.season.week
      prop.year = constants.season.year
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

  for (const category of draftkings.categories) {
    const { offers, events } = await draftkings.getOffers(category)

    if (!offers) continue

    for (const offer of offers) {
      const event = events.find((e) => e.eventId === offer.eventId)
      const teams = event
        ? [fixTeam(event.teamShortName1), fixTeam(event.teamShortName2)]
        : []

      if (
        category.type ===
        constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS
      ) {
        const line = 0.5
        await handle_leader_market({ offer, category, teams, line })
      } else {
        const is_leader_market = constants.player_prop_types_leaders.includes(
          category.type
        )
        if (is_leader_market) {
          await handle_leader_market({ offer, category, teams })
        } else {
          await handle_over_under_market({ offer, category, teams })
        }
      }
    }

    await wait(5000)
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
