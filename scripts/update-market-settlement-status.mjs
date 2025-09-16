#!/usr/bin/env node

/**
 * Standalone script to update market settlement status
 *
 * A market is considered settled when ALL its selections have results.
 * This script is idempotent and can be run independently or called from other scripts.
 *
 * Usage:
 *   node scripts/update-market-settlement-status.mjs [options]
 *
 * Options:
 *   --year <year>        Process markets for specific year
 *   --week <week>        Process markets for specific week
 *   --seas_type <type>   Season type (PRE, REG, POST)
 *   --esbids <ids>       Comma-separated game IDs to process
 *   --dry_run            Preview changes without updating database
 *   --verbose            Enable detailed logging
 */

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import db from '#db'
import { is_main } from '#libs-server'

const log = debug('update-market-settlement')

/**
 * Update market settlement status for markets where all selections are settled
 *
 * @param {Object} options - Processing options
 * @param {number} options.year - Filter by year
 * @param {number} options.week - Filter by week (requires joining with nfl_games)
 * @param {string} options.seas_type - Filter by season type (requires joining with nfl_games)
 * @param {Array<string>} options.esbids - Filter by game IDs
 * @param {boolean} options.dry_run - Preview mode
 * @param {boolean} options.verbose - Verbose logging
 * @returns {Promise<number>} Number of markets updated
 */
export const update_market_settlement_status = async ({
  year,
  week,
  seas_type,
  esbids,
  dry_run = false,
  verbose = false
}) => {
  const start_time = Date.now()

  // Build WHERE conditions
  const conditions = []
  const bindings = {}

  if (year) {
    conditions.push('pmi.year = :year')
    bindings.year = year
  }

  // For week and seas_type filtering, we need to join with nfl_games
  const needs_game_join = week || seas_type

  if (week) {
    conditions.push('ng.week = :week')
    bindings.week = week
  }

  if (seas_type) {
    conditions.push('ng.seas_type = :seas_type')
    bindings.seas_type = seas_type
  }

  if (esbids && esbids.length > 0) {
    // Handle both array and comma-separated string
    const esbid_array = Array.isArray(esbids)
      ? esbids
      : esbids.split(',').map((id) => id.trim())
    conditions.push(
      `pmi.esbid IN (${esbid_array.map((_, i) => `:esbid_${i}`).join(',')})`
    )
    esbid_array.forEach((id, i) => {
      bindings[`esbid_${i}`] = id
    })
  }

  const where_clause =
    conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''

  // Find markets where all selections are settled but market is not marked as settled
  const query = `
    WITH market_settlement_check AS (
      SELECT
        pmi.source_id,
        pmi.source_market_id,
        pmi.time_type,
        pmi.market_settled,
        pmi.esbid,
        pmi.year,
        pmi.market_type,
        ${needs_game_join ? 'ng.week, ng.seas_type,' : ''}
        COUNT(DISTINCT pms.source_selection_id) as total_selections,
        COUNT(DISTINCT CASE
          WHEN pms.selection_result IS NOT NULL
          THEN pms.source_selection_id
        END) as settled_selections
      FROM prop_markets_index pmi
      JOIN prop_market_selections_index pms ON
        pmi.source_id = pms.source_id
        AND pmi.source_market_id = pms.source_market_id
        AND pmi.time_type = pms.time_type
      ${needs_game_join ? 'JOIN nfl_games ng ON pmi.esbid = ng.esbid' : ''}
      WHERE 1=1
        ${where_clause}
      GROUP BY
        pmi.source_id,
        pmi.source_market_id,
        pmi.time_type,
        pmi.market_settled,
        pmi.esbid,
        pmi.year,
        pmi.market_type
        ${needs_game_join ? ', ng.week, ng.seas_type' : ''}
    )
    SELECT
      source_id::text,
      source_market_id,
      time_type::text,
      total_selections,
      settled_selections,
      market_settled,
      esbid,
      year,
      ${needs_game_join ? 'week, seas_type::text,' : ''}
      market_type
    FROM market_settlement_check
    WHERE total_selections = settled_selections  -- All selections are settled
      AND total_selections > 0                   -- Has selections
      AND market_settled = false                 -- Not already marked as settled
    ORDER BY source_id, source_market_id, time_type
  `

  if (verbose) {
    log(`Checking markets for settlement with filters:`, {
      year,
      week,
      seas_type,
      esbids: esbids?.length || 0
    })
  }

  const result = await db.raw(query, bindings)
  const markets_to_settle = result.rows

  log(`Found ${markets_to_settle.length} markets to mark as settled`)

  if (
    verbose &&
    markets_to_settle.length > 0 &&
    markets_to_settle.length <= 10
  ) {
    log('Markets to settle:')
    markets_to_settle.forEach((m) => {
      log(
        `  ${m.source_id} | ${m.source_market_id} | ${m.time_type} | ${m.market_type} (${m.settled_selections}/${m.total_selections} selections)`
      )
    })
  }

  if (dry_run) {
    log(`DRY RUN: Would update ${markets_to_settle.length} markets`)
    return markets_to_settle.length
  }

  if (markets_to_settle.length === 0) {
    return 0
  }

  // Update in batches for performance
  let updated = 0
  const batch_size = 100

  for (let i = 0; i < markets_to_settle.length; i += batch_size) {
    const batch = markets_to_settle.slice(i, i + batch_size)

    await db.transaction(async (trx) => {
      for (const market of batch) {
        const update_count = await trx('prop_markets_index')
          .where({
            source_id: market.source_id,
            source_market_id: market.source_market_id,
            time_type: market.time_type
          })
          .update({
            market_settled: true
          })

        if (update_count > 0) {
          updated++
        }
      }
    })

    if (verbose && updated > 0 && updated % 500 === 0) {
      log(`Progress: ${updated}/${markets_to_settle.length}`)
    }
  }

  const duration = Date.now() - start_time
  log(`✓ Updated ${updated} market settlement statuses in ${duration}ms`)

  return updated
}

// CLI interface
const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .usage(
      '$0 [options]',
      'Update settlement status for markets where all selections are settled'
    )
    .option('year', {
      type: 'number',
      describe: 'Year to process'
    })
    .option('week', {
      type: 'number',
      describe: 'Week to process'
    })
    .option('seas_type', {
      type: 'string',
      describe: 'Season type (PRE, REG, POST)',
      choices: ['PRE', 'REG', 'POST']
    })
    .option('esbids', {
      type: 'string',
      describe: 'Comma-separated game IDs to process'
    })
    .option('dry_run', {
      type: 'boolean',
      default: false,
      describe: 'Preview changes without updating database'
    })
    .option('verbose', {
      type: 'boolean',
      default: false,
      describe: 'Enable verbose logging'
    })
    .example('$0 --year 2025 --week 2', 'Update settlements for week 2 of 2025')
    .example(
      '$0 --esbids 401547417,401547418 --dry_run',
      'Preview updates for specific games'
    )
    .example(
      '$0 --year 2025 --verbose',
      'Update all 2025 markets with detailed logging'
    )
    .help()
    .parse()

  // Enable debug logging
  if (argv.verbose || (!argv.help && !process.argv.includes('--help'))) {
    debug.enable('update-market-settlement')
  }

  try {
    const result = await update_market_settlement_status(argv)

    if (argv.dry_run) {
      log(`DRY RUN completed: ${result} markets would be updated`)
    }
  } catch (error) {
    log(`Error: ${error.message}`)
    console.error(error)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

if (is_main(import.meta.url)) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
