import debug from 'debug'
import fetch from 'node-fetch'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, groupBy } from '#common'
import { isMain, getPlayer } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:odds')
debug.enable('import:odds,get-player')

const URL = 'https://sportsbook.draftkings.com/leagues/football/3'

const types = {
  /* 'Most Passing Yards in the Regular Season': constants.oddTypes.SEASON_PASSING,
   * 'Most Rushing Yards in the Regular Season': constants.oddTypes.SEASON_RUSHING,
   * 'Most Receiving Yards in the Regular Season': constants.oddTypes.SEASON_RECEIVING, */
  'Total Passing Yards by the Player': constants.oddTypes.GAME_PASSING,
  'Total Pass Completions by the Player - Including Overtime':
    constants.oddTypes.GAME_COMPLETIONS,
  'Total Touchdown Passes Thrown by the Player - Including Overtime':
    constants.oddTypes.GAME_PASSING_TOUCHDOWN,
  'Total Interceptions thrown by the Player':
    constants.oddTypes.GAME_INTERCEPTIONS,
  'Total Rushing Yards by the Player - Including Overtime':
    constants.oddTypes.GAME_RUSHING,
  'Total Receiving Yards by the Player - Including Overtime':
    constants.oddTypes.GAME_RECEIVING,
  'Total Receptions by the Player': constants.oddTypes.GAME_RECEPTIONS
}

const timestamp = Math.round(Date.now() / 1000)

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

  // request page
  const data = await fetch(URL).then((res) => res.text())

  // parse out data
  const regex = /window\.__INITIAL_STATE__\s=\s+([^\n]+)/i
  const embeddedData = data.match(regex)

  // format data
  const parsed = JSON.parse(embeddedData[1].slice(0, -1))

  // fs.writeJsonSync('draftkings.json', parsed, { spaces: 2 })
  // const parsed = fs.readJsonSync('draftkings.json')

  const offers = {}
  const missing = []
  for (const offer of Object.values(parsed.offers[3])) {
    if (!types[offer.label]) continue
    if (!offers[offer.label]) offers[offer.label] = []
    offer.outcomes.forEach((o) => offers[offer.label].push(o))
  }

  const props = []
  for (const [type, value] of Object.entries(offers)) {
    // group by providerOfferId
    const groups = groupBy(value, 'providerOfferId')

    for (const [id, bets] of Object.entries(groups)) {
      const prop = {}

      // find player
      let player_row
      const params = { name: bets[0].participant }
      try {
        player_row = await getPlayer(params)
        if (!player_row) {
          missing.push(params)
          continue
        }
      } catch (err) {
        console.log(err)
        missing.push(params)
        continue
      }

      prop.pid = player_row.pid
      prop.type = types[type]
      prop.id = id
      prop.timestamp = timestamp
      prop.wk = constants.season.week
      prop.year = constants.season.year
      prop.sourceid = constants.sources.DRAFT_KINGS

      const betInfo = bets[0].label.split(' ')
      prop.ln = parseFloat(betInfo[1], 10)

      for (const bet of bets) {
        const betInfo = bet.label.split(' ')
        const betType = betInfo[0]
        if (betType === 'Over') {
          prop.o = bet.oddsDecimal
        } else if (betType === 'Under') {
          prop.u = bet.oddsDecimal
        }
      }
      props.push(prop)
    }
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (argv.dry) {
    log(props[0])
    return
  }

  log(`Inserting ${props.length} props into database`)
  await db('props').insert(props)
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
    type: constants.jobs.DRAFTKINGS_ODDS,
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
