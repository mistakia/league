import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'

import db from '#db'
import { current_season } from '#constants'
import { is_main, insert_prop_markets, report_job } from '#libs-server'
import {
  preload_active_players,
  get_cache_stats
} from '#libs-server/player-cache.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

// Local modules
import {
  CONFIG,
  DEBUG_MODULES,
  parse_filters,
  run_all_mode,
  run_events_mode,
  analyze_formatted_markets,
  log_failed_requests_summary,
  log_processing_summary
} from '#libs-server/draftkings/index.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('mode', {
      describe: 'Import mode',
      type: 'string',
      default: 'all',
      choices: ['all', 'events']
    })
    .option('categories', {
      describe: 'Comma-separated list of category IDs to filter',
      type: 'string'
    })
    .option('subcategories', {
      describe: 'Comma-separated list of subcategory IDs to filter',
      type: 'string'
    })
    .option('events', {
      describe:
        'Comma-separated list of event IDs to process (events mode only)',
      type: 'string'
    })
    .option('use-tracking', {
      describe: 'Use tracking data to filter categories/subcategories',
      type: 'string',
      choices: ['active', 'priority'],
      conflicts: ['categories', 'subcategories']
    })
    .option('tracking-days', {
      describe: 'Days to look back for active tracking filter',
      type: 'number',
      default: 7
    })
    .option('dry', {
      describe: 'Dry run - do not insert to database',
      type: 'boolean',
      default: false
    })
    .option('write', {
      describe: 'Write JSON files to tmp directory',
      type: 'boolean',
      default: false
    })
    .help('h')
    .alias('h', 'help')
    .example('$0', 'Import all categories and subcategories')
    .example(
      '$0 --mode events',
      'Import using events mode (faster for specific events)'
    )
    .example('$0 --categories 492,528', 'Import specific categories by ID')
    .example(
      '$0 --subcategories 17147,17223',
      'Import specific subcategories by ID'
    )
    .example(
      '$0 --mode events --events 32225662 --categories 492',
      'Import game lines for specific event'
    )
    .example(
      '$0 --use-tracking active --tracking-days 3',
      'Import categories active in last 3 days'
    )
    .example(
      '$0 --use-tracking priority',
      'Import priority categories (recent activity + good success rates)'
    )
    .example('$0 --dry --write', 'Dry run with JSON output files')
    .epilogue(
      'Modes:\n' +
        '  all:    Process all league categories and subcategories\n' +
        '  events: Process specific events with their categories\n\n' +
        'Tracking Filters:\n' +
        '  active:   Categories that had offers in the last N days\n' +
        '  priority: Categories with recent activity OR good success rates\n\n' +
        'Common Category IDs:\n' +
        '  492:  Game Lines (spreads, totals, moneylines)\n' +
        '  1000: Passing Props\n' +
        '  1001: Rushing/Receiving Props\n' +
        '  1342: Receiving Props\n' +
        '  634:  Season Leaders'
    ).argv
}

const log = debug('import-draft-kings')
debug.enable(DEBUG_MODULES.join(','))

// Helper functions moved to separate modules

// Analysis functions moved to separate modules

// Market formatting moved to separate module

// Filter parsing moved to separate module

// Processing functions moved to separate module

// Event processing moved to separate module

/**
 * Main execution function for DraftKings odds import
 */
const run = async () => {
  const argv = initialize_cli()
  console.time('import-draft-kings')

  // Preload player cache for performance optimization
  await preload_player_cache()

  const timestamp = Math.round(Date.now() / 1000)
  const nfl_games = await db('nfl_games').where({
    year: current_season.year
  })

  log(`Running in ${argv.mode} mode`)

  // Parse filters
  const { category_filter, subcategory_filter } = await parse_filters(argv)
  const event_filter = argv.events ? argv.events.split(',') : null

  // Process markets based on mode
  console.time('draftkings-market-processing')
  let results
  if (argv.mode === 'events') {
    results = await run_events_mode({
      nfl_games,
      timestamp,
      category_filter,
      subcategory_filter,
      event_filter
    })
  } else {
    results = await run_all_mode({
      nfl_games,
      timestamp,
      category_filter,
      subcategory_filter
    })
  }
  console.timeEnd('draftkings-market-processing')

  const { formatted_markets, all_markets, failed_requests } = results

  // Log summaries
  log_failed_requests_summary(failed_requests)
  log_processing_summary(formatted_markets, failed_requests)

  // Analysis of formatted markets
  if (formatted_markets.length > 0) {
    analyze_formatted_markets(formatted_markets)
  }

  // Write output files if requested
  if (argv.write) {
    await write_output_files(
      timestamp,
      all_markets,
      formatted_markets,
      failed_requests
    )
  }

  // Handle dry run
  if (argv.dry) {
    log(formatted_markets[0])
    return
  }

  // Insert into database
  if (formatted_markets.length) {
    await insert_markets_to_database(formatted_markets)
  }

  console.timeEnd('import-draft-kings')
}

/**
 * Preloads player cache for performance optimization
 */
const preload_player_cache = async () => {
  console.time('draftkings-player-cache-preload')
  log('Preloading player cache for performance optimization...')
  await preload_active_players()
  console.timeEnd('draftkings-player-cache-preload')

  const draftkings_player_cache_stats = get_cache_stats()
  log(
    `Player cache loaded: ${draftkings_player_cache_stats.total_players} players, ${draftkings_player_cache_stats.formatted_name_entries} name entries`
  )
}

/**
 * Writes output files to tmp directory
 * @param {number} timestamp - Timestamp for file naming
 * @param {Array} all_markets - Raw markets data
 * @param {Array} formatted_markets - Formatted markets data
 * @param {Array} failed_requests - Failed requests data
 */
const write_output_files = async (
  timestamp,
  all_markets,
  formatted_markets,
  failed_requests
) => {
  await fs.writeFile(
    `./tmp/${CONFIG.FILE_OUTPUT.PREFIX}-${CONFIG.FILE_OUTPUT.EXTENSIONS.RAW}-${timestamp}.json`,
    JSON.stringify(all_markets, null, 2)
  )

  await fs.writeFile(
    `./tmp/${CONFIG.FILE_OUTPUT.PREFIX}-${CONFIG.FILE_OUTPUT.EXTENSIONS.FORMATTED}-${timestamp}.json`,
    JSON.stringify(formatted_markets, null, 2)
  )

  if (failed_requests.length > 0) {
    await fs.writeFile(
      `./tmp/${CONFIG.FILE_OUTPUT.PREFIX}-${CONFIG.FILE_OUTPUT.EXTENSIONS.FAILED}-${timestamp}.json`,
      JSON.stringify(failed_requests, null, 2)
    )
  }
}

/**
 * Inserts markets into database
 * @param {Array} formatted_markets - Formatted markets to insert
 */
const insert_markets_to_database = async (formatted_markets) => {
  console.time('draftkings-database-insertion')
  log(`Inserting ${formatted_markets.length} markets into database`)
  await insert_prop_markets(formatted_markets)
  console.timeEnd('draftkings-database-insertion')
}

export const job = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.DRAFTKINGS_ODDS,
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

export default run
