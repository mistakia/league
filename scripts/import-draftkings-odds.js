// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
const fetch = require('node-fetch')
// const jsonfile = require('jsonfile')
const argv = require('yargs').argv

const log = debug('import:odds')
debug.enable('import:odds')

const { constants, groupBy } = require('../common')
const db = require('../db')
const { getPlayerId } = require('../utils')

const URL = 'https://sportsbook.draftkings.com/leagues/football/3'

const types = {
  /* 'Most Passing Yards in the Regular Season': constants.oddTypes.SEASON_PASSING,
   * 'Most Rushing Yards in the Regular Season': constants.oddTypes.SEASON_RUSHING,
   * 'Most Receiving Yards in the Regular Season': constants.oddTypes.SEASON_RECEIVING, */
  'Total Passing Yards by the Player': constants.oddTypes.GAME_PASSING,
  'Total Pass Completions by the Player - Including Overtime': constants.oddTypes.GAME_COMPLETIONS,
  'Total Touchdown Passes Thrown by the Player - Including Overtime': constants.oddTypes.GAME_PASSING_TOUCHDOWN,
  'Total Interceptions thrown by the Player': constants.oddTypes.GAME_INTERCEPTIONS,
  'Total Rushing Yards by the Player - Including Overtime': constants.oddTypes.GAME_RUSHING,
  'Total Receiving Yards by the Player - Including Overtime': constants.oddTypes.GAME_RECEIVING,
  'Total Receptions by the Player': constants.oddTypes.GAME_RECEPTIONS
}

const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  // request page
  const data = await fetch(URL).then(res => res.text())

  // parse out data
  const regex = /window\.__INITIAL_STATE__\s=\s+([^\n]+)/i
  const embeddedData = data.match(regex)

  // format data
  const parsed = JSON.parse(embeddedData[1].slice(0, -1))

  // jsonfile.writeFileSync('draftkings.json', parsed, { spaces: 2 })
  // const parsed = jsonfile.readFileSync('draftkings.json')

  const offers = {}
  const missing = []
  for (const offer of Object.values(parsed.offers[3])) {
    if (!types[offer.label]) continue
    if (!offers[offer.label]) offers[offer.label] = []
    offer.outcomes.forEach(o => offers[offer.label].push(o))
  }

  const props = []
  for (const [type, value] of Object.entries(offers)) {
    // group by providerOfferId
    const groups = groupBy(value, 'providerOfferId')

    for (const [id, bets] of Object.entries(groups)) {
      const prop = {}

      // find player
      let playerId
      const params = { name: bets[0].participant }
      try {
        playerId = await getPlayerId(params)
        if (!playerId) {
          missing.push(params)
          continue
        }
      } catch (err) {
        console.log(err)
        missing.push(params)
        continue
      }

      prop.player = playerId
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
  missing.forEach(m => log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`))

  if (argv.dry) {
    log(props[0])
    return
  }

  log(`Inserting ${props.length} props into database`)
  await db('props').insert(props)
}

module.exports = run

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.DRAFTKINGS_ODDS,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (!module.parent) {
  main()
}
