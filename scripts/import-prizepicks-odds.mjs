import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, prizepicks, getPlayer, insertProps } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-prizepicks-odds')
debug.enable('import-prizepicks-odds,get-player,prizepicks')

const import_prizepicks_odds = async () => {
  // do not pull in reports outside of the NFL season
  if (
    !constants.season.now.isBetween(
      constants.season.start,
      constants.season.end
    )
  ) {
    return
  }

  console.time('import-prizepicks-odds')

  const timestamp = Math.round(Date.now() / 1000)

  const props = []
  const missing = []

  const nfl_games = await db('nfl_games').where({
    week: constants.season.nfl_seas_week,
    year: constants.season.year,
    seas_type: constants.season.nfl_seas_type
  })

  let page = 1
  let data
  do {
    data = await prizepicks.getPlayerProps({ page })

    for (const item of data.data) {
      // ignore unsupported stat types
      if (!prizepicks.stats[item.attributes.stat_type]) continue

      let player_row

      const item_player = data.included.find(
        (d) =>
          d.type === 'new_player' &&
          d.id === item.relationships.new_player.data.id
      )
      if (!item_player) {
        // TODO log warning
        continue
      }

      const params = {
        name: item_player.attributes.name,
        team: item_player.attributes.team
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

      const nfl_game = nfl_games.find(
        (game) => game.v === player_row.cteam || game.h === player_row.cteam
      )

      if (!nfl_game) {
        continue
      }

      const prop = {}
      prop.pid = player_row.pid
      prop.prop_type = prizepicks.stats[item.attributes.stat_type]
      prop.id = item.id
      prop.timestamp = timestamp
      prop.week = constants.season.week
      prop.year = constants.season.year
      prop.esbid = nfl_game.esbid
      prop.sourceid = constants.sources.PRIZEPICKS
      prop.active = true

      prop.ln = Number(item.attributes.line_score)

      prop.o = null
      prop.o_am = null
      prop.u = null
      prop.u_am = null

      props.push(prop)
    }

    page += 1
  } while (!data || data.meta.current_page < data.meta.total_pages)

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

  console.timeEnd('import-prizepicks-odds')
}

export const job = async () => {
  let error
  try {
    await import_prizepicks_odds()
  } catch (err) {
    error = err
    log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.PRIZEPICKS_PROJECTIONS,
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

export default import_prizepicks_odds
