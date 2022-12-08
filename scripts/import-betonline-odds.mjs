import fetch from 'node-fetch'
import fs from 'fs-extra'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Odds } from 'oddslib'

import db from '#db'
import { constants } from '#common'
import { isMain, getPlayer, insertProps } from '#utils'

const argv = yargs(hideBin(process.argv)).argv

const log = debug('import:odds')
debug.enable('import:odds,get-player')

const URL =
  'https://widgets.digitalsportstech.com/api/feed?' +
  [
    'betType=in,18,19',
    'isActive=1',
    'limit=9999',
    'tz=-5',
    'sb=betonline',
    'leagueId=142'
  ].join('&')

const types = {
  'Passing Yards': constants.player_prop_types.GAME_PASSING_YARDS,
  'Pass Completions': constants.player_prop_types.GAME_PASSING_COMPLETIONS,
  'Passing TDs': constants.player_prop_types.GAME_PASSING_TOUCHDOWNS,
  'Rushing Yards': constants.player_prop_types.GAME_RUSHING_YARDS,
  'Receiving Yards': constants.player_prop_types.GAME_RECEIVING_YARDS,
  Receptions: constants.player_prop_types.GAME_RECEPTIONS,
  Carries: constants.player_prop_types.GAME_RUSHING_ATTEMPTS
  // Touchdowns: constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS
}

const timestamp = Math.round(Date.now() / 1000)

// betType 1 is at least
// betType 18 is Under
// betType 19 is Over

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
  let parsed

  const tmpFile = '/tmp/betonline.json'
  if (argv.test && fs.existsSync(tmpFile)) {
    parsed = fs.readJsonSync(tmpFile)
  } else {
    parsed = await fetch(URL).then((res) => res.json())
    fs.writeJsonSync(tmpFile, parsed, { spaces: 2 })
  }

  const missing = []
  const props = []

  for (const item of parsed.data) {
    if (item.game1.leagueId !== 142) continue
    if (!types[item.statistic.title]) continue

    // find player
    let player_row
    const params = {
      name: item.player1.name,
      team: item.player1.team.abbreviation
    }
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

    for (const bet of item.markets) {
      const index =
        bet.type !== 1
          ? props.findIndex(
              (p) =>
                p.pid === player_row.pid &&
                p.type === types[item.statistic.title]
            )
          : -1
      const prop = index > -1 ? props[index] : {}
      prop.pid = player_row.pid
      prop.prop_type = types[item.statistic.title]
      prop.id = bet.id
      prop.timestamp = timestamp
      prop.week = constants.season.week
      prop.year = constants.season.year
      prop.sourceid = constants.sources.BETONLINE
      prop.active = true

      switch (bet.type) {
        case 1:
          prop.ln = bet.value - 0.5
          prop.o = bet.odds
          prop.o_am = Odds.from('decimal', bet.odds).to('moneyline', {
            precision: 0
          })
          break

        case 18:
          prop.ln = bet.value
          prop.u = bet.odds
          prop.u_am = Odds.from('decimal', bet.odds).to('moneyline', {
            precision: 0
          })
          break

        case 19:
          prop.ln = bet.value
          prop.o = bet.odds
          prop.o_am = Odds.from('decimal', bet.odds).to('moneyline', {
            precision: 0
          })
          break

        default:
          log(`unrecognized bet type ${bet.type}`)
      }

      if (index === -1) props.push(prop)
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
    type: constants.jobs.BETONLINE_ODDS,
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
