import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'node:fs/promises'

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
import { touchdown_market_types } from '#libs-server/prizepicks.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-prizepicks-odds')

// Only claim the namespace set when nothing else has configured one. This module
// is imported as a library by jobs/import-live-odds-worker.mjs, and a
// module-scope debug.enable REPLACES the whole set for the importing process --
// so this line ran during the worker's import phase and, being the LAST of the
// three importers it loads, silently switched off every namespace the worker's
// DEBUG had turned on, including insert-prop-markets.
if (!process.env.DEBUG) {
  debug.enable('import-prizepicks-odds,get-player,prizepicks')
}

const format_market = async ({
  prizepicks_market,
  observed_at,
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
        game.away_nfl_team === player_row.current_nfl_team ||
        game.home_nfl_team === player_row.current_nfl_team
    )
  }

  // Extract and normalize the line
  const raw_line = Number(prizepicks_market.attributes?.line_score) || null
  const normalized_line = normalize_selection_metric_line({
    raw_value: raw_line,
    selection_name: prizepicks_market.attributes?.stat_type || ''
  })

  // Get market type with line context for proper routing
  const market_type = prizepicks.get_market_type(
    prizepicks_market.attributes?.stat_type,
    { selection_metric_line: normalized_line }
  )

  // Normalize selection types for touchdown markets (OVER/UNDER -> YES/NO)
  const is_touchdown_market = touchdown_market_types.has(market_type)
  const over_selection_type = is_touchdown_market ? 'YES' : 'OVER'
  const under_selection_type = is_touchdown_market ? 'NO' : 'UNDER'

  selections.push({
    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_selection_id: `${prizepicks_market.id}-over`,
    selection_type: over_selection_type,

    selection_pid: player_row?.pid || null,
    selection_name: is_touchdown_market ? 'yes' : 'over',
    selection_metric_line: normalized_line,
    odds_decimal: null,
    odds_american: null
  })

  selections.push({
    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_selection_id: `${prizepicks_market.id}-under`,
    selection_type: under_selection_type,

    selection_pid: player_row?.pid || null,
    selection_name: is_touchdown_market ? 'no' : 'under',
    selection_metric_line: normalized_line,
    odds_decimal: null,
    odds_american: null
  })

  return {
    market_type,

    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_market_name: `${prizepicks_market.attributes?.projection_type} - ${prizepicks_market.attributes?.stat_type}`,

    esbid: nfl_game?.esbid || null,
    source_event_id: prizepicks_market.attributes?.game_id || null,
    source_event_name: null,

    is_open: true,
    is_live: false,
    selection_count: 2,
    season_year: current_season.year,

    observed_at,
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
  const observed_at = new Date()
  const formatted_markets = []
  const all_markets = []
  const missing_market_types = new Set()

  const nfl_games = await db('nfl_games').where({
    week: current_season.nfl_seas_week,
    season_year: current_season.year,
    season_type: current_season.nfl_seas_type
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
        observed_at,
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

  // Rethrow so the exit code matches the outcome -- reporting the error and
  // then returning normally made main() exit 0, writing a failed import to the
  // runs ledger as a success.
  if (error) throw error
}

const main = async () => {
  try {
    await job()
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_prizepicks_odds
