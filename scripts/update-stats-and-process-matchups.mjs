/**
 * Update Stats and Process Matchups for All Weeks
 *
 * This script processes all weeks from 1 to the current week (or specified week):
 * 1. Calculates player gamelogs and updates stats from play-by-play data (no play import)
 * 2. Processes matchups for all hosted leagues
 *
 * Note: This script does NOT import plays - it uses existing play-by-play data
 * from the nfl_plays table. Use import-plays-nfl-v1.mjs first if plays are missing.
 *
 * Usage:
 *   node scripts/update-stats-and-process-matchups.mjs
 *   node scripts/update-stats-and-process-matchups.mjs --week 8
 *   node scripts/update-stats-and-process-matchups.mjs --year 2025 --week 10
 */

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main } from '#libs-server'
import { get_target_week } from '#libs-shared'

import process_stats_for_week from './process-stats-for-week.mjs'
import process_matchups from './process-matchups.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('update-stats-and-process-matchups')
debug.enable('update-stats-and-process-matchups')

// ----------------------------
// Helper Functions
// ----------------------------

/**
 * Gets all hosted, non-archived league IDs
 */
const get_hosted_league_ids = async () => {
  return await db('leagues')
    .where({ hosted: 1 })
    .whereNull('archived_at')
    .pluck('uid')
}

// ----------------------------
// Processing Functions
// ----------------------------

/**
 * Updates stats for all weeks from 1 to target_week
 * This calculates player gamelogs from existing play-by-play data
 */
const process_all_weeks_stats = async ({ target_week, year }) => {
  log(`\n=== Updating stats for weeks 1 through ${target_week} ===`)

  for (let week = 1; week <= target_week; week++) {
    const week_start_time = Date.now()
    log(`\nProcessing week ${week}/${target_week}...`)

    try {
      await process_stats_for_week({ week })
      const duration = ((Date.now() - week_start_time) / 1000).toFixed(1)
      log(`✓ Completed week ${week} in ${duration}s`)
    } catch (err) {
      log(`✗ Error processing week ${week}: ${err.message}`)
      throw err
    }
  }

  log(`\n✓ Completed stats updates for all ${target_week} weeks`)
}

/**
 * Processes matchups for all hosted leagues
 */
const process_all_league_matchups = async ({ year }) => {
  log(`\n=== Processing matchups for all leagues ===`)

  const league_ids = await get_hosted_league_ids()

  if (league_ids.length === 0) {
    log('No hosted leagues found to process')
    return
  }

  log(`Found ${league_ids.length} league(s) to process`)

  for (const lid of league_ids) {
    const league_start_time = Date.now()
    log(`\nProcessing matchups for league ${lid}...`)

    try {
      await process_matchups({ lid, year })
      const duration = ((Date.now() - league_start_time) / 1000).toFixed(1)
      log(`✓ Completed league ${lid} in ${duration}s`)
    } catch (err) {
      log(`✗ Error processing league ${lid}: ${err.message}`)
      throw err
    }
  }

  log(`\n✓ Completed matchups for all ${league_ids.length} league(s)`)
}

// ----------------------------
// Main Function
// ----------------------------

/**
 * Main processing function that orchestrates stats updates and matchup processing
 */
const update_stats_and_process_matchups = async ({
  week: target_week,
  year = current_season.year
} = {}) => {
  const start_time = Date.now()

  // Determine target week if not provided
  if (!target_week) {
    target_week = get_target_week()
  }

  // Validate week range
  if (target_week < 1 || target_week > current_season.regularSeasonFinalWeek) {
    throw new Error(
      `Invalid week: ${target_week}. Must be between 1 and ${current_season.regularSeasonFinalWeek}`
    )
  }

  log(`\n${'='.repeat(60)}`)
  log(`Starting stats and matchup processing`)
  log(`Year: ${year}`)
  log(`Weeks: 1 through ${target_week}`)
  log(`${'='.repeat(60)}`)

  try {
    // Step 1: Update stats for all weeks
    await process_all_weeks_stats({ target_week, year })

    // Step 2: Process matchups for all leagues
    await process_all_league_matchups({ year })

    const total_duration = ((Date.now() - start_time) / 1000).toFixed(1)
    log(`\n${'='.repeat(60)}`)
    log(`✓ Successfully completed all processing`)
    log(`Total duration: ${total_duration}s`)
    log(`${'='.repeat(60)}\n`)
  } catch (err) {
    const total_duration = ((Date.now() - start_time) / 1000).toFixed(1)
    log(`\n${'='.repeat(60)}`)
    log(`✗ Processing failed after ${total_duration}s`)
    log(`${'='.repeat(60)}\n`)
    throw err
  }
}

// ----------------------------
// CLI Entry Point
// ----------------------------

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await update_stats_and_process_matchups({
      week: argv.week,
      year: argv.year
    })
  } catch (err) {
    error = err
    log(error)
    console.error('Error:', err.message)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default update_stats_and_process_matchups
