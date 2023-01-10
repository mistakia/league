import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, team_aliases } from '#common'
import { isMain, getPlayer, caesars, wait, insertProps } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-caesars')
debug.enable('import-caesars,get-player,caesars')

const formatTeamName = (str) => {
  str = str.replaceAll('|', '')
  return team_aliases[str]
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

  console.time('import-caesars-odds')

  const timestamp = Math.round(Date.now() / 1000)

  const missing = []
  const props = []

  const schedule = await caesars.getSchedule()
  log(schedule)

  // filter events to those for current week
  const week_end = constants.season.week_end
  const current_week_events = schedule.competitions[0].events.filter((event) =>
    dayjs(event.startTime).isBefore(week_end)
  )

  log(`Getting odds for ${current_week_events.length} events`)

  for (const event of current_week_events) {
    const event_odds = await caesars.getEvent(event.id)

    const supported_markets = Object.keys(caesars.markets)

    for (const market of event_odds.markets) {
      // ignore unsuported markets
      if (
        !market.metadata ||
        !supported_markets.includes(market.metadata.marketCategory)
      ) {
        continue
      }

      let player_row
      const team = formatTeamName(market.metadata.teamName)
      const params = {
        name: market.metadata.player,
        team
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
      prop.prop_type = caesars.markets[market.metadata.marketCategory]
      prop.id = market.id
      prop.timestamp = timestamp
      prop.week = constants.season.week
      prop.year = constants.season.year
      prop.sourceid = constants.sources.CAESARS_VA
      prop.active = Boolean(market.active)
      prop.live = Boolean(market.tradedInPlay)

      prop.ln = Number(market.line)

      for (const selection of market.selections) {
        if (selection.type === 'over') {
          prop.o = Number(selection.price.d)
          prop.o_am = Number(selection.price.a)
        } else if (selection.type === 'under') {
          prop.u = Number(selection.price.d)
          prop.u_am = Number(selection.price.a)
        }
      }
      props.push(prop)
    }

    await wait(5000)
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) => log(`could not find player: ${m.name} / ${m.team}`))

  if (argv.dry) {
    log(props[0])
    return
  }

  if (props.length) {
    log(`Inserting ${props.length} props into database`)
    await insertProps(props)
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
