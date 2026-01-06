#!/usr/bin/env node

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Worker } from 'worker_threads'
import { fileURLToPath } from 'url'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import db from '#db'
import report_job from '#libs-server/report-job.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { get_target_week } from '#libs-shared'
import { current_season } from '#constants'
import { get_supported_market_types } from '#libs-server/prop-market-settlement/market-type-mappings.mjs'
import { preload_game_data } from '#libs-server/prop-market-settlement/data-preloader.mjs'
import { write_selection_results_to_db } from '#libs-server/prop-market-settlement/selection-result-writer.mjs'
import { chunk_array } from '#libs-shared/chunk.mjs'
import {
  format_duration,
  validate_games_with_data,
  fetch_markets_for_games
} from '#libs-server/prop-market-settlement/prop-market-utils.mjs'
import { update_market_settlement_status } from './update-market-settlement-status.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .usage(
      '$0 [options]',
      'Process prop market results with simplified parallel processing'
    )
    .option('year', {
      type: 'number',
      describe: 'Season year to process',
      default: 2025
    })
    .option('week', {
      type: 'number',
      describe:
        'Specific week to process (default: most relevant week based on day of week)'
    })
    .option('seas_type', {
      type: 'string',
      describe: 'Season type (PRE, REG, POST)',
      choices: ['PRE', 'REG', 'POST']
    })
    .option('dry_run', {
      type: 'boolean',
      default: false,
      describe: 'Preview without database writes'
    })
    .option('batch_size', {
      type: 'number',
      default: 250,
      describe: 'Markets per worker task'
    })
    .option('workers', {
      type: 'number',
      describe: 'Worker threads (default: auto-detect)'
    })
    .option('verbose', {
      type: 'boolean',
      default: false,
      describe: 'Enable verbose logging'
    })
    .option('missing_only', {
      type: 'boolean',
      default: false,
      describe: 'Only process markets with missing results'
    })
    .option('error_report', {
      type: 'string',
      describe: 'Export detailed error report to file'
    })
    .option('error_sample_size', {
      type: 'number',
      default: 10,
      describe: 'Number of error examples to show per error type'
    })
    .option('esbids', {
      type: 'string',
      describe: 'Comma-separated game IDs to process (overrides week/year)'
    })
    .example('$0 --week 5 --dry_run', 'Preview week 5 processing')
    .example('$0 --workers 8 --verbose', 'Use 8 workers with verbose output')
    .example('$0 --seas_type POST --week 1', 'Process playoff week 1')
    .example('$0 --missing_only', 'Only process markets with missing results')
    .example(
      '$0 --error_report errors.json --error_sample_size 20',
      'Export detailed error report'
    )
    .example('$0 --esbids 401547417,401547418', 'Process specific games by ID')
    .help()
    .parse()
}

const log = debug('process-market-results')

// Global argv variable to be initialized in main
let argv

/**
 * Simple is_main check
 */
const is_main = (url) => process.argv[1] === fileURLToPath(url)

/**
 * Analyze and categorize errors from processing results
 * @param {Array} results - Array of processing results
 * @returns {Object} Error analysis with counts and samples
 */
const analyze_errors = (results) => {
  const error_results = results.filter((r) => r.error)
  const error_counts = {}
  const error_samples = {}
  const market_type_errors = {}
  const handler_type_errors = {}

  for (const result of error_results) {
    const error_message = result.error
    const market_type = result.market_type || 'unknown'
    const handler_type = result.handler_type || 'unknown'

    // Count by error message
    error_counts[error_message] = (error_counts[error_message] || 0) + 1

    // Count by market type
    market_type_errors[market_type] = (market_type_errors[market_type] || 0) + 1

    // Count by handler type
    handler_type_errors[handler_type] =
      (handler_type_errors[handler_type] || 0) + 1

    // Collect samples for each error type
    if (!error_samples[error_message]) {
      error_samples[error_message] = []
    }
    if (error_samples[error_message].length < argv.error_sample_size) {
      error_samples[error_message].push({
        source_id: result.source_id,
        source_market_id: result.source_market_id,
        source_selection_id: result.source_selection_id,
        market_type: result.market_type,
        handler_type: result.handler_type,
        esbid: result.esbid,
        selection_pid: result.selection_pid,
        selection_type: result.selection_type,
        selection_metric_line: result.selection_metric_line,
        time_type: result.time_type
      })
    }
  }

  return {
    total_errors: error_results.length,
    unique_error_types: Object.keys(error_counts).length,
    error_counts,
    error_samples,
    market_type_errors,
    handler_type_errors
  }
}

/**
 * Generate detailed error report
 * @param {Object} error_analysis - Error analysis results
 * @returns {string} Formatted error report
 */
const generate_error_report = (error_analysis) => {
  const {
    total_errors,
    unique_error_types,
    error_counts,
    error_samples,
    market_type_errors,
    handler_type_errors
  } = error_analysis

  let report = `\n=== ERROR ANALYSIS REPORT ===\n`
  report += `Total Errors: ${total_errors}\n`
  report += `Unique Error Types: ${unique_error_types}\n\n`

  // Top error types by count
  report += `=== TOP ERROR TYPES ===\n`
  const sorted_errors = Object.entries(error_counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)

  for (const [error_message, count] of sorted_errors) {
    const percentage = ((count / total_errors) * 100).toFixed(1)
    report += `${count} (${percentage}%): ${error_message}\n`
  }

  // Market type breakdown
  report += `\n=== ERRORS BY MARKET TYPE ===\n`
  const sorted_market_types = Object.entries(market_type_errors).sort(
    ([, a], [, b]) => b - a
  )

  for (const [market_type, count] of sorted_market_types) {
    const percentage = ((count / total_errors) * 100).toFixed(1)
    report += `${count} (${percentage}%): ${market_type}\n`
  }

  // Handler type breakdown
  report += `\n=== ERRORS BY HANDLER TYPE ===\n`
  const sorted_handler_types = Object.entries(handler_type_errors).sort(
    ([, a], [, b]) => b - a
  )

  for (const [handler_type, count] of sorted_handler_types) {
    const percentage = ((count / total_errors) * 100).toFixed(1)
    report += `${count} (${percentage}%): ${handler_type}\n`
  }

  // Error samples
  report += `\n=== ERROR SAMPLES ===\n`
  for (const [error_message, samples] of Object.entries(error_samples)) {
    if (samples.length > 0) {
      report += `\n--- ${error_message} (${error_counts[error_message]} total) ---\n`
      for (const sample of samples) {
        report += `  Market: ${sample.market_type} | Handler: ${sample.handler_type} | Game: ${sample.esbid} | Player: ${sample.selection_pid} | Line: ${sample.selection_metric_line}\n`
      }
    }
  }

  return report
}

/**
 * Export error report to file
 * @param {Object} error_analysis - Error analysis results
 * @param {string} filename - Output filename
 */
const export_error_report = async (error_analysis, filename) => {
  const report_data = {
    timestamp: new Date().toISOString(),
    summary: {
      total_errors: error_analysis.total_errors,
      unique_error_types: error_analysis.unique_error_types
    },
    error_counts: error_analysis.error_counts,
    market_type_errors: error_analysis.market_type_errors,
    handler_type_errors: error_analysis.handler_type_errors,
    error_samples: error_analysis.error_samples
  }

  await fs.writeFile(filename, JSON.stringify(report_data, null, 2))
  log(`Error report exported to: ${filename}`)
}

/**
 * Process markets with workers
 *
 * @param {Object} params - Named parameters
 * @param {Array} params.market_batches - Array of market batches to process
 * @param {Object} params.preloaded_data - Preloaded game data for processing
 * @param {Object} params.config - Configuration object with workers, verbose options
 * @returns {Promise<Array>} Array of processed market results
 */
const process_markets_with_workers = async ({
  market_batches,
  preloaded_data,
  config = {}
}) => {
  const worker_count =
    config.workers || Math.max(1, Math.min(os.cpus().length - 2, 12))
  const worker_path = path.join(
    __dirname,
    '../libs-server/prop-market-settlement/worker/market-calculator-worker.mjs'
  )

  log(
    `Processing ${market_batches.length} batches with ${worker_count} workers`
  )

  let completed_batches = 0
  const progress_interval = Math.max(1, Math.floor(market_batches.length / 20)) // Log every 5%
  const start_time = Date.now()

  const results = await Promise.all(
    market_batches.map(async (batch, index) => {
      return new Promise((resolve, reject) => {
        const worker = new Worker(worker_path, {
          workerData: {
            worker_id: index % worker_count,
            verbose: config.verbose,
            preloaded_data
          }
        })

        worker.on('message', (result) => {
          worker.terminate()
          completed_batches++

          // Log progress every 5% or every 100 batches, whichever is more frequent
          if (
            completed_batches % Math.min(progress_interval, 100) === 0 ||
            completed_batches === market_batches.length
          ) {
            const progress = (
              (completed_batches / market_batches.length) *
              100
            ).toFixed(1)
            const elapsed = Date.now() - start_time
            const rate = ((completed_batches / elapsed) * 1000).toFixed(1)
            log(
              `Progress: ${completed_batches}/${market_batches.length} batches (${progress}%) - ${rate} batches/sec`
            )
          }

          if (result.error) {
            reject(new Error(result.error))
          } else {
            resolve(result)
          }
        })

        worker.on('error', (error) => {
          worker.terminate()
          reject(error)
        })

        worker.postMessage({
          task_id: index,
          markets: batch
        })
      })
    })
  )

  return results.flat()
}

/**
 * Core processing logic shared by CLI and programmatic interfaces
 *
 * @param {Object} options - Processing options
 * @param {Object} options.config - Configuration object with year, week, seas_type, etc.
 * @param {boolean} options.enable_error_reporting - Enable detailed error analysis
 * @param {boolean} options.enable_job_reporting - Enable job status reporting
 * @param {boolean} options.close_db_on_complete - Close database connection when done
 * @returns {Promise<Object>} Processing results with stats
 */
const execute_processing = async ({
  config,
  enable_error_reporting = false,
  enable_job_reporting = false,
  close_db_on_complete = false
}) => {
  const start_time = Date.now()
  const seas_type = config.seas_type || current_season.nfl_seas_type
  const week = config.week || get_target_week()

  let esbids

  // Determine games to process
  if (config.esbids) {
    esbids =
      typeof config.esbids === 'string'
        ? config.esbids.split(',').map((id) => id.trim())
        : config.esbids
    log(`Processing specific games: ${esbids.join(', ')}`)
  } else {
    log(
      `Starting market results processing for year ${config.year} week ${week} ${seas_type}`
    )

    const query = db('nfl_games')
      .select('esbid')
      .where('year', config.year)
      .andWhere('seas_type', seas_type)
      .andWhere('week', week)
    log(`Query: ${query.toString()}`)
    const games = await query
    log(`Raw games result: ${games.length} games`)
    esbids = games.map((g) => g.esbid)
  }

  const make_early_exit_result = () => ({
    processed: 0,
    successful: 0,
    errors: 0,
    duration: Date.now() - start_time
  })

  if (esbids.length === 0) {
    log('No games found to process')
    if (close_db_on_complete) await db.destroy()
    return make_early_exit_result()
  }

  log(`Found ${esbids.length} games to process`)

  // Validate games have complete data
  const valid_esbids = await validate_games_with_data(esbids)
  if (valid_esbids.length === 0) {
    log('No games with complete score data')
    if (close_db_on_complete) await db.destroy()
    return make_early_exit_result()
  }

  log(`${valid_esbids.length} games have complete data`)

  // Get supported market types and fetch markets
  const supported_market_types = get_supported_market_types()
  const markets = await fetch_markets_for_games({
    esbids: valid_esbids,
    year: config.year,
    missing_only: config.missing_only,
    supported_market_types
  })

  if (markets.length === 0) {
    log('No markets to process')
    if (close_db_on_complete) await db.destroy()
    return make_early_exit_result()
  }

  log(`Found ${markets.length} markets to process`)

  // Preload all required data
  log('Preloading game data...')
  const preloaded_data = await preload_game_data(valid_esbids)
  log(
    `Loaded ${preloaded_data.player_gamelogs.length} gamelogs, ${preloaded_data.nfl_plays.length} plays, ${preloaded_data.nfl_games.length} games`
  )

  // Create market batches and process
  const market_batches = chunk_array({
    items: markets,
    chunk_size: config.batch_size
  })
  log(`Created ${market_batches.length} batches of size ${config.batch_size}`)

  log(`Starting parallel processing...`)
  const processing_start = Date.now()
  const results = await process_markets_with_workers({
    market_batches,
    preloaded_data,
    config
  })
  const processing_duration = Date.now() - processing_start

  log(`Processing completed in ${format_duration(processing_duration)}`)
  log(
    `Processed ${results.length} market results (${markets.length} markets x 2 time_types)`
  )

  // Prepare database updates
  const successful_results = results.filter(
    (r) => !r.error && r.selection_result !== null
  )
  const updates = successful_results.map((r) => ({
    source_id: r.source_id,
    source_market_id: r.source_market_id,
    source_selection_id: r.source_selection_id,
    time_type: r.time_type,
    selection_result: r.selection_result,
    metric_value: r.metric_value
  }))

  const error_count = results.length - successful_results.length
  log(`${successful_results.length} successful results, ${error_count} errors`)

  // Error reporting (CLI only)
  if (enable_error_reporting && error_count > 0) {
    const error_analysis = analyze_errors(results)
    const error_report = generate_error_report(error_analysis)
    console.log(error_report)

    if (config.error_report) {
      await export_error_report(error_analysis, config.error_report)
    }

    if (config.verbose) {
      log('=== VERBOSE ERROR DETAILS ===')
      const error_results = results.filter((r) => r.error)
      for (const error_result of error_results.slice(0, 50)) {
        log(`Error: ${error_result.error}`)
        log(
          `  Market: ${error_result.market_type} | Handler: ${error_result.handler_type}`
        )
        log(
          `  Game: ${error_result.esbid} | Player: ${error_result.selection_pid}`
        )
        log(
          `  Selection: ${error_result.selection_type} | Line: ${error_result.selection_metric_line}`
        )
        log(`  Time Type: ${error_result.time_type}`)
        log('---')
      }
      if (error_results.length > 50) {
        log(
          `... and ${error_results.length - 50} more errors (use --error_report to export all)`
        )
      }
    }
  }

  // Write results to database (functions handle dry_run internally with detailed logging)
  if (updates.length > 0) {
    log(`Writing ${updates.length} results to database...`)
    const { selection_count } = await write_selection_results_to_db({
      updates,
      dry_run: config.dry_run
    })
    if (!config.dry_run) {
      log(`Written ${selection_count} selection results`)
    }

    // Update market settlement status
    log(`Checking market settlement status for ${valid_esbids.length} games...`)
    const markets_updated = await update_market_settlement_status({
      esbids: valid_esbids,
      dry_run: config.dry_run,
      verbose: config.verbose
    })
    if (!config.dry_run) {
      log(`Updated ${markets_updated} market settlement statuses`)
    }
  }

  const total_duration = Date.now() - start_time
  log(`Total execution time: ${format_duration(total_duration)}`)

  // Job reporting (CLI only)
  if (enable_job_reporting && !config.dry_run) {
    await report_job({
      job_type: job_types.PROCESS_MARKET_RESULTS,
      succ: true,
      reason: `Processed ${results.length} markets in ${format_duration(total_duration)}`,
      timestamp: Math.round(start_time / 1000)
    })
  }

  if (close_db_on_complete) {
    await db.destroy()
  }

  return {
    processed: results.length,
    successful: successful_results.length,
    errors: error_count,
    duration: total_duration
  }
}

const main = async () => {
  // Initialize CLI arguments
  argv = initialize_cli()

  // Enable debug logging when not showing help
  if (!process.argv.includes('--help')) {
    debug.enable('process-market-results,selection-result-writer')
  }

  const start_time = Date.now()
  let processing_error = null

  try {
    await execute_processing({
      config: argv,
      enable_error_reporting: true,
      enable_job_reporting: true,
      close_db_on_complete: false // Handle cleanup in finally block
    })
  } catch (error) {
    processing_error = error
    log(`Error: ${error.message}`)

    if (!argv.dry_run) {
      try {
        await report_job({
          job_type: job_types.PROCESS_MARKET_RESULTS,
          succ: false,
          reason: error.message,
          timestamp: Math.round(start_time / 1000)
        })
      } catch (report_error) {
        log(`Failed to report job error: ${report_error.message}`)
      }
    }
  } finally {
    await db.destroy()
  }

  if (processing_error) {
    throw processing_error
  }
}

/**
 * Process market results for specified games
 * Wrapper function for programmatic use (e.g., from finalize_game)
 *
 * @param {Object} params
 * @param {number} params.year - Season year
 * @param {number} params.week - Week number (optional if esbids provided)
 * @param {string} params.seas_type - Season type (PRE, REG, POST)
 * @param {Array<string>} params.esbids - Array of game IDs to process
 * @param {boolean} params.dry_run - Preview mode
 * @param {boolean} params.verbose - Verbose logging
 * @returns {Promise<Object>} Processing results with stats
 */
export const process_market_results = async ({
  year,
  week,
  seas_type,
  esbids,
  dry_run = false,
  verbose = false
} = {}) => {
  debug.enable('process-market-results,selection-result-writer')

  const config = {
    year: year || current_season.year,
    week,
    seas_type,
    esbids,
    dry_run,
    verbose,
    batch_size: 250,
    workers: undefined,
    missing_only: false,
    error_report: undefined,
    error_sample_size: 10
  }

  return execute_processing({
    config,
    enable_error_reporting: false,
    enable_job_reporting: false,
    close_db_on_complete: false
  })
}

if (is_main(import.meta.url)) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export default main
