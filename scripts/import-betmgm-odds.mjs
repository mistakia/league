import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import {
  isMain,
  betmgm,
  getPlayer,
  insertProps,
  insert_prop_markets
} from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-betmgm-odds')
debug.enable('import-betmgm-odds,get-player,betmgm,insert-prop-market')

const team_name_re = /\(([^)]+)\)/

const import_betmgm_odds = async () => {
  console.time('import-betmgm-odds')

  const timestamp = Math.round(Date.now() / 1000)

  const props = []
  const missing = []
  const formatted_markets = []

  const nfl_games = await db('nfl_games').where({
    week: constants.season.nfl_seas_week,
    year: constants.season.year,
    seas_type: constants.season.nfl_seas_type
  })

  const { all_markets, nfl_game_markets } = await betmgm.get_markets()

  for (const market of all_markets) {
    formatted_markets.push({
      market_id: String(market.id),
      source_id: constants.sources.BETMGM_US,
      source_event_id: null,
      source_market_name: market.name.value,
      market_name: market.name.value,
      open: market.visibility === 'Visible',
      live: false,
      runners: market.results.length,
      market_type: betmgm.markets[market.templateId] || null,
      timestamp
    })
  }

  if (formatted_markets.length) {
    log(`inserting ${formatted_markets.length} markets`)
    await insert_prop_markets(formatted_markets)
  }

  // do not pull in props outside of the NFL season
  if (
    !constants.season.now.isBetween(
      constants.season.start,
      constants.season.end
    )
  ) {
    console.timeEnd('import-betmgm-odds')
    return
  }

  for (const player_prop of nfl_game_markets) {
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

    const nfl_game = nfl_games.find(
      (game) => game.v === player_row.cteam || game.h === player_row.cteam
    )

    if (!nfl_game) {
      continue
    }

    const prop = {}
    prop.pid = player_row.pid
    prop.prop_type = betmgm.markets[player_prop.templateId]
    prop.id = player_prop.id
    prop.timestamp = timestamp
    prop.week = constants.season.week
    prop.year = constants.season.year
    prop.esbid = nfl_game.esbid
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

  console.timeEnd('import-betmgm-odds')
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
