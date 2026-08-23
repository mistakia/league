import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'node:fs/promises'

import db from '#db'
import { current_season } from '#constants'
import {
  is_main,
  insert_prop_markets,
  report_job,
  emit_signal,
  resolve_signal
} from '#libs-server'
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
  log_processing_summary,
  unmapped_season_player_prop_subcategories,
  get_tracking_write_stats,
  reset_tracking_write_stats
} from '#libs-server/draftkings/index.mjs'
import { create_logger } from '#libs-shared/log.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const signal_log = create_logger('import-draftkings-odds', {
  service: 'league-imports'
})

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

enable_debug_namespaces(DEBUG_MODULES.join(','))

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

  // Counters are module state in draftkings-tracking.mjs and this worker is
  // long-lived, so a run must start from zero or it inherits the previous run's
  // verdict.
  reset_tracking_write_stats()

  // Preload player cache for performance optimization
  await preload_player_cache()

  const file_timestamp = Math.round(Date.now() / 1000)
  const observed_at = new Date()
  const nfl_games = await db('nfl_games')
    .select('*', 'season_year as year', 'season_type as seas_type')
    .where({
      season_year: current_season.year
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
      observed_at,
      category_filter,
      subcategory_filter,
      event_filter
    })
  } else {
    results = await run_all_mode({
      nfl_games,
      observed_at,
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
      file_timestamp,
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
 * @param {object[]} all_markets - Raw markets data
 * @param {object[]} formatted_markets - Formatted markets data
 * @param {object[]} failed_requests - Failed requests data
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
 * @param {object[]} formatted_markets - Formatted markets to insert
 */
const insert_markets_to_database = async (formatted_markets) => {
  console.time('draftkings-database-insertion')
  log(`Inserting ${formatted_markets.length} markets into database`)
  await insert_prop_markets(formatted_markets)
  console.timeEnd('draftkings-database-insertion')
}

// Category-tracking write oracle.
//
// draftkings_category_activity had failed EVERY write since the module shipped
// (2025-10-01) and sat at zero rows: every statement raised Postgres 42702, the
// per-write catch swallowed it, and the run reported success. The only trace was
// in the database log. Two rules from user:guideline/surface-pipeline-failures.md
// shape what replaces it.
//
// Aggregate, never per write. This path runs once per subcategory -- roughly 480
// times per run, six runs a day -- so a per-error emit is the level-based
// detector the guideline warns against.
//
// Assert on a number the run already computes, not a threshold. The tracking
// write is unconditional for every subcategory the sweep touches, so the honest
// oracle is `write_failures === 0`, with `write_attempts > 0` distinguishing a
// healthy run from one that never reached the path at all (a --dry run, or a
// category filter that selected nothing). A run with zero attempts asserts
// nothing and must neither emit nor resolve.
//
// Deliberately NOT fatal. Category tracking is auxiliary -- it feeds only the
// opt-in --use-tracking filters -- so throwing here would abort a ~21-minute
// odds sweep and lose real prop data over a bookkeeping table. What changes is
// that the failure now leaves the run with a different observable than success.
const TRACKING_FAILURE_DEDUP_KEY = 'draftkings-category-tracking:write-failures'

const report_category_tracking_outcome = async () => {
  const { write_attempts, write_failures, first_failure_message } =
    get_tracking_write_stats()

  if (!write_attempts) return

  if (write_failures > 0) {
    log(
      `draftkings_category_activity: ${write_failures} of ${write_attempts} tracking writes failed (${first_failure_message})`
    )
    await emit_signal({
      source: 'service:import-live-odds-worker',
      kind: 'pipeline_failure',
      // Nothing user-facing degrades and the odds import itself is unaffected,
      // but a categorical write failure means the table is frozen rather than
      // merely lagging, and it stays that way until someone looks.
      severity: 'medium',
      title: `DraftKings category tracking dropped ${write_failures} of ${write_attempts} write(s)`,
      payload: {
        write_attempts,
        write_failures,
        first_failure_message
      },
      dedup_key: TRACKING_FAILURE_DEDUP_KEY
    })
    return
  }

  // Gated on the observed healthy condition rather than an in-process "did I
  // emit" latch: pm2 reloads this worker on every deploy, so a latch would
  // strand an open signal permanently. The route is a cheap 200 no-op when
  // nothing is open.
  await resolve_signal({
    dedup_key: TRACKING_FAILURE_DEDUP_KEY,
    resolution_note: `all ${write_attempts} category tracking writes succeeded`
  })
}

export const job = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  // Classification oracle, deliberately not fatal: a new season-long
  // subcategory is drift to be wired up, not a failed run, and this importer
  // drives the continuous live-odds worker. Without it a new subcategory only
  // reaches a debug namespace that is off in production, so the selections land
  // with a null market_type and no consumer can ever see them.
  if (unmapped_season_player_prop_subcategories.size) {
    const subcategory_ids = [
      ...unmapped_season_player_prop_subcategories
    ].sort()
    const emitted = signal_log.error(
      new Error(
        `DraftKings offer category 1759 (season-long player totals) returned unmapped subcategoryIds: ${subcategory_ids.join(', ')}. Their markets are ingested with a null market_type and are invisible to consumers until mapped in draftkings-market-types.mjs.`
      ),
      { severity: 'low', context: { subcategory_ids } }
    )
    if (emitted?.promise) {
      await emitted.promise
    }
    unmapped_season_player_prop_subcategories.clear()
  }

  await report_category_tracking_outcome()

  await report_job({
    job_type: job_types.DRAFTKINGS_ODDS,
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

export default run
