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

const timestamp = Math.round(Date.now() / 1000)

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

  const supported_markets = Object.keys(fanduel.markets)

  for (const event of current_week_events) {
    for (const tab of fanduel.tabs) {
      const data = await fanduel.getEventTab({ eventId: event.eventId, tab })

      for (const market of Object.values(data.attachments.markets)) {
        // ignore unsuported markets
        if (
          !market.marketType ||
          !supported_markets.includes(market.marketType)
        ) {
          continue
        }

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

        const prop = {}
        prop.pid = player_row.pid
        prop.type = fanduel.markets[market.marketType]
        prop.id = market.marketId
        prop.timestamp = timestamp
        prop.week = constants.season.week
        prop.year = constants.season.year
        prop.sourceid = constants.sources.FANDUEL_NJ

        prop.ln = parseFloat(market.runners[0].handicap, 10)

        for (const selection of market.runners) {
          if (selection.result.type.toLowerCase() === 'over') {
            prop.o = selection.winRunnerOdds.trueOdds.decimalOdds.decimalOdds
            prop.o_am =
              selection.winRunnerOdds.americanDisplayOdds.americanOddsInt
          } else if (selection.result.type.toLowerCase() === 'under') {
            prop.u = selection.winRunnerOdds.trueOdds.decimalOdds.decimalOdds
            prop.u_am =
              selection.winRunnerOdds.americanDisplayOdds.americanOddsInt
          }
        }
        props.push(prop)
      }
    }

    await wait(5000)
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

const main = async () => {
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

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
