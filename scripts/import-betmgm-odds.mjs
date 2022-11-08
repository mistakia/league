import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, betmgm, getPlayer, insertProps } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-betmgm-odds')
debug.enable('import-betmgm-odds,get-player,betmgm')

const team_name_re = /\(([^)]+)\)/

const import_betmgm_odds = async () => {
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

  const props = []
  const missing = []

  const player_props = await betmgm.getPlayerProps()

  for (const player_prop of player_props) {
    let player_row

    const matches = team_name_re.exec(player_prop.player1.value)
    const params = { name: player_prop.player1.short, team: matches[1] }
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
    prop.type = betmgm.markets[player_prop.templateId]
    prop.id = player_prop.id
    prop.timestamp = timestamp
    prop.week = constants.season.week
    prop.year = constants.season.year
    prop.sourceid = constants.sources.BETMGM_US
    prop.active = true
    prop.live = false

    prop.ln = Number(player_prop.results[0].attr)

    for (const result of player_prop.results) {
      if (result.name.value.includes('Over')) {
        prop.o = Number(result.odds)
        prop.o_am = Number(result.americanOdds)
      } else if (result.name.value.includes('Under')) {
        prop.u = Number(result.odds)
        prop.u_am = Number(result.americanOdds)
      }
    }
    props.push(prop)
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
}

export const job = async () => {
  let error
  try {
    await import_betmgm_odds()
  } catch (err) {
    error = err
    log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.BETMGM_ODDS,
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

export default import_betmgm_odds
