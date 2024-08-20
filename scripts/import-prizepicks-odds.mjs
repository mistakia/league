import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'

import db from '#db'
import { constants } from '#libs-shared'
import {
  isMain,
  prizepicks,
  getPlayer,
  insert_prop_markets
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-prizepicks-odds')
debug.enable('import-prizepicks-odds,get-player,prizepicks')

const format_market = async ({
  prizepicks_market,
  timestamp,
  prizepicks_player,
  nfl_games = []
}) => {
  const selections = []
  let player_row
  let nfl_game

  const params = {
    name: prizepicks_player.attributes.name,
    team: prizepicks_player.attributes.team,
    ignore_free_agent: true,
    ignore_retired: true
  }

  try {
    player_row = await getPlayer(params)
  } catch (err) {
    log(err)
  }

  if (player_row) {
    nfl_game = nfl_games.find(
      (game) =>
        game.v === player_row.current_nfl_team ||
        game.h === player_row.current_nfl_team
    )
  }

  selections.push({
    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_selection_id: `${prizepicks_market.id}-over`,

    selection_pid: player_row?.pid || null,
    selection_name: 'over',
    selection_metric_line:
      Number(prizepicks_market.attributes?.line_score) || null,
    odds_decimal: null,
    odds_american: null
  })

  selections.push({
    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_selection_id: `${prizepicks_market.id}-under`,

    selection_pid: player_row?.pid || null,
    selection_name: 'under',
    selection_metric_line:
      Number(prizepicks_market.attributes?.line_score) || null,
    odds_decimal: null,
    odds_american: null
  })

  return {
    market_type: null, // TODO use projection_type and stat_type

    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_market_name: `${prizepicks_market.attributes?.projection_type} - ${prizepicks_market.attributes?.stat_type}`,

    esbid: nfl_game?.esbid || null,
    source_event_id: prizepicks_market.attributes?.game_id || null,
    source_event_name: null,

    open: true,
    live: false,
    selection_count: 2,

    timestamp,
    selections
  }
}

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
  const formatted_markets = []
  const all_markets = []

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
      all_markets.push(item)

      const prizepicks_player = data.included.find(
        (d) =>
          d.type === 'new_player' &&
          d.id === item.relationships.new_player.data.id
      )

      if (!prizepicks_player) {
        // TODO log warning
        continue
      }

      formatted_markets.push(
        await format_market({
          prizepicks_market: item,
          prizepicks_player,
          timestamp,
          nfl_games
        })
      )
    }

    page += 1
  } while (!data || data.meta.current_page < data.meta.total_pages)

  if (argv.write) {
    await fs.writeFile(
      `./tmp/prizepick-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
  }

  if (argv.dry) {
    log(formatted_markets[0])
    console.timeEnd('import-prizepicks-odds')
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets into database`)
    await insert_prop_markets(formatted_markets)
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
    type: job_types.PRIZEPICKS_PROJECTIONS,
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
