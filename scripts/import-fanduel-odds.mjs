import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getPlayer, fanduel, wait, insertProps } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fanduel')
debug.enable('import-fanduel,get-player,fanduel')

const formatPlayerName = (str) => {
  str = str.split('-')[0]
  return str.trim()
}

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

  const events = await fanduel.getEvents()

  // filter events to those for current week
  const week_end = constants.season.week_end
  const current_week_events = events.filter(
    (event) =>
      dayjs(event.openDate).isBefore(week_end) && event.name !== 'NFL Matches'
  )

  log(`Getting odds for ${current_week_events.length} events`)

  const handle_over_under_market = ({ market, player_row }) => {
    const prop = {}
    prop.pid = player_row.pid
    prop.type = fanduel.markets[market.marketType]
    prop.id = market.marketId
    prop.timestamp = timestamp
    prop.week = constants.season.week
    prop.year = constants.season.year
    prop.sourceid = constants.sources.FANDUEL_NJ
    prop.active = true

    prop.ln = parseFloat(market.runners[0].handicap, 10)

    for (const selection of market.runners) {
      if (selection.result.type.toLowerCase() === 'over') {
        prop.o = Number(
          selection.winRunnerOdds.trueOdds.decimalOdds.decimalOdds
        )
        prop.o_am = Number(
          selection.winRunnerOdds.americanDisplayOdds.americanOddsInt
        )
      } else if (selection.result.type.toLowerCase() === 'under') {
        prop.u = Number(
          selection.winRunnerOdds.trueOdds.decimalOdds.decimalOdds
        )
        prop.u_am = Number(
          selection.winRunnerOdds.americanDisplayOdds.americanOddsInt
        )
      }
    }
    props.push(prop)
  }

  const handle_alt_line_market = ({ market, player_row }) => {
    for (const selection of market.runners) {
      const prop = {}
      prop.pid = player_row.pid
      prop.type = fanduel.markets[market.marketType]
      prop.id = market.marketId
      prop.timestamp = timestamp
      prop.week = constants.season.week
      prop.year = constants.season.year
      prop.sourceid = constants.sources.FANDUEL_NJ
      prop.active = true

      const runner_name_number = Number(
        selection.runnerName.replace(/\D+/g, '')
      )
      prop.ln = runner_name_number - 0.5
      prop.o = Number(selection.winRunnerOdds.trueOdds.decimalOdds.decimalOdds)
      prop.o_am = Number(
        selection.winRunnerOdds.americanDisplayOdds.americanOddsInt
      )

      props.u = null
      props.u_am = null

      props.push(prop)
    }
  }

  const handle_leader_market = async (market) => {
    for (const selection of market.runners) {
      let player_row
      // TODO get team
      const params = {
        name: selection.runnerName
      }

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
      prop.type = fanduel.leader_market_names[market.marketName]
      prop.id = market.marketId
      prop.timestamp = timestamp
      prop.week = constants.season.week
      prop.year = constants.season.year
      prop.sourceid = constants.sources.FANDUEL_NJ
      prop.active = true

      prop.ln = null
      prop.o = Number(selection.winRunnerOdds.trueOdds.decimalOdds.decimalOdds)
      prop.o_am = Number(
        selection.winRunnerOdds.americanDisplayOdds.americanOddsInt
      )

      props.u = null
      props.u_am = null

      props.push(prop)
    }
  }

  for (const event of current_week_events) {
    for (const tab of fanduel.tabs) {
      const data = await fanduel.getEventTab({ eventId: event.eventId, tab })

      for (const market of Object.values(data.attachments.markets)) {
        // ignore unsuported markets
        if (!market.marketType || !fanduel.markets[market.marketType]) {
          continue
        }

        const is_leader_market = fanduel.leader_markets[market.marketType]
        if (is_leader_market) {
          await handle_leader_market(market)
        } else {
          let player_row
          // TODO get team
          const params = {
            name: formatPlayerName(market.marketName)
          }

          try {
            player_row = await getPlayer(params)
          } catch (err) {
            log(err)
          }

          if (!player_row) {
            missing.push(params)
            continue
          }

          const is_alt_line_market = fanduel.alt_line_markets[market.marketType]
          if (is_alt_line_market) {
            handle_alt_line_market({ market, player_row })
          } else {
            handle_over_under_market({ market, player_row })
          }
        }
      }
    }

    await wait(5000)
  }

  const weekly_specials_markets = await fanduel.getWeeklySpecials()
  for (const market of weekly_specials_markets) {
    await handle_leader_market(market)
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

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
    type: constants.jobs.FANDUEL_ODDS,
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
