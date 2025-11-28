import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'

import db from '#db'
import { current_season } from '#constants'
import {
  is_main,
  prizepicks,
  find_player_row,
  insert_prop_markets,
  report_job
} from '#libs-server'
import { normalize_selection_metric_line } from '#libs-server/normalize-selection-metric-line.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

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
    player_row = await find_player_row(params)
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

  // Extract and normalize the line
  const raw_line = Number(prizepicks_market.attributes?.line_score) || null
  const normalized_line = normalize_selection_metric_line({
    raw_value: raw_line,
    selection_name: prizepicks_market.attributes?.stat_type || ''
  })

  selections.push({
    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_selection_id: `${prizepicks_market.id}-over`,
    selection_type: 'OVER',

    selection_pid: player_row?.pid || null,
    selection_name: 'over',
    selection_metric_line: normalized_line,
    odds_decimal: null,
    odds_american: null
  })

  selections.push({
    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_selection_id: `${prizepicks_market.id}-under`,
    selection_type: 'UNDER',

    selection_pid: player_row?.pid || null,
    selection_name: 'under',
    selection_metric_line: normalized_line,
    odds_decimal: null,
    odds_american: null
  })

  return {
    market_type: prizepicks.get_market_type(
      prizepicks_market.attributes?.stat_type
    ),

    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_market_name: `${prizepicks_market.attributes?.projection_type} - ${prizepicks_market.attributes?.stat_type}`,

    esbid: nfl_game?.esbid || null,
    source_event_id: prizepicks_market.attributes?.game_id || null,
    source_event_name: null,

    open: true,
    live: false,
    selection_count: 2,
    year: current_season.year,

    timestamp,
    selections
  }
}

const import_prizepicks_odds = async ({
  dry_run = false,
  write_file = false
} = {}) => {
  // do not pull in reports outside of the NFL season
  if (
    !current_season.now.isBetween(
      current_season.regular_season_start,
      current_season.end
    )
  ) {
    return
  }

  console.time('import-prizepicks-odds')

  const timestamp = Math.round(Date.now() / 1000)
  const formatted_markets = []
  const all_markets = []
  const missing_market_types = new Set()

  const nfl_games = await db('nfl_games').where({
    week: current_season.nfl_seas_week,
    year: current_season.year,
    seas_type: current_season.nfl_seas_type
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

      const market = await format_market({
        prizepicks_market: item,
        prizepicks_player,
        timestamp,
        nfl_games
      })

      if (!market.market_type) {
        missing_market_types.add(item.attributes?.stat_type)
      }

      formatted_markets.push(market)
    }

    page += 1
  } while (!data || data.meta.current_page < data.meta.total_pages)

  if (write_file) {
    await fs.writeFile(
      `./tmp/prizepick-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
  }

  if (missing_market_types.size > 0) {
    log('Stat types with missing market types:')
    missing_market_types.forEach((stat_type) => log(stat_type))
  }

  if (dry_run) {
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
  const argv = initialize_cli()
  let error
  try {
    await import_prizepicks_odds({
      dry_run: argv.dry,
      write_file: argv.write
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.PRIZEPICKS_PROJECTIONS,
    error
  })
}

const main = async () => {
  await job()
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_prizepicks_odds
