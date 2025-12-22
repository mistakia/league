import debug from 'debug'

import db from '#db'
import { create_default_league } from '#libs-shared'
import { getLeague } from '#libs-server'

import generate_scoring_format_player_gamelogs from '#scripts/generate-scoring-format-player-gamelogs.mjs'
import generate_scoring_format_player_seasonlogs from '#scripts/generate-scoring-format-player-seasonlogs.mjs'
import generate_scoring_format_player_careerlogs from '#scripts/generate-scoring-format-player-careerlogs.mjs'
import generate_league_format_player_gamelogs from '#scripts/generate-league-format-player-gamelogs.mjs'
import generate_league_format_player_seasonlogs from '#scripts/generate-league-format-player-seasonlogs.mjs'
import generate_league_format_player_careerlogs from '#scripts/generate-league-format-player-careerlogs.mjs'
import generate_nfl_team_seasonlogs from '#scripts/generate-nfl-team-seasonlogs.mjs'
import process_player_seasonlogs from '#scripts/process-player-seasonlogs.mjs'
import generate_player_career_game_counts from '#scripts/generate-player-career-game-counts.mjs'

const log = debug('stats-pipeline')

// ============================================================================
// Shared Data Access
// ============================================================================

/**
 * Get all active hosted league IDs
 * @returns {Promise<number[]>} Array of league UIDs
 */
export const get_hosted_league_ids = async () => {
  return db('leagues')
    .where({ hosted: 1 })
    .whereNull('archived_at')
    .pluck('uid')
}

/**
 * Get unique format hashes across all hosted leagues
 * @returns {Promise<Object>} Object containing sets of unique hashes and default league
 */
export const get_format_hashes = async () => {
  const default_league = create_default_league()
  const league_ids = await get_hosted_league_ids()

  const scoring_format_hashes = new Set([default_league.scoring_format_hash])
  // Map league_format_hash -> lid (for gamelogs that need lid)
  const league_formats = new Map([
    [default_league.league_format_hash, { lid: 0 }]
  ])

  for (const lid of league_ids) {
    const league = await getLeague({ lid })
    scoring_format_hashes.add(league.scoring_format_hash)
    if (!league_formats.has(league.league_format_hash)) {
      league_formats.set(league.league_format_hash, { lid })
    }
  }

  return {
    default_league,
    scoring_format_hashes: Array.from(scoring_format_hashes),
    league_formats // Map of league_format_hash -> { lid }
  }
}

// ============================================================================
// Step Runner with Standardized Error Handling
// ============================================================================

/**
 * Run a pipeline step with timing and error handling
 * @param {Object} params
 * @param {string} params.name - Step name for logging
 * @param {Function} params.fn - Async function to execute
 * @param {Object} params.results - Results object to update (optional)
 * @param {boolean} params.continue_on_error - Whether to continue on error (default: true)
 * @param {Function} params.logger - Logger function (optional)
 * @returns {Promise<Object>} Result object with success, duration, error
 */
export const run_step = async ({
  name,
  fn,
  results = null,
  continue_on_error = true,
  logger = log
}) => {
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start
    logger(`${name} completed in ${duration}ms`)
    if (results?.steps_completed) {
      results.steps_completed.push(name)
    }
    return { success: true, duration, result }
  } catch (error) {
    const duration = Date.now() - start
    logger(`${name} failed after ${duration}ms: ${error.message}`)
    if (results?.steps_failed) {
      results.steps_failed.push({ step: name, error: error.message })
    }
    if (!continue_on_error) {
      throw error
    }
    return { success: false, duration, error }
  }
}

// ============================================================================
// Format Processing Pipelines
// ============================================================================

/**
 * Process scoring format gamelogs for all unique scoring formats
 * @param {Object} params
 * @param {number} params.week - Week number
 * @returns {Promise<void>}
 */
export const process_all_scoring_format_gamelogs = async ({ week }) => {
  const { scoring_format_hashes } = await get_format_hashes()

  for (const scoring_format_hash of scoring_format_hashes) {
    log(`Processing scoring format gamelogs: ${scoring_format_hash}`)
    await generate_scoring_format_player_gamelogs({ week, scoring_format_hash })
  }
}

/**
 * Process league format gamelogs for all unique league formats
 * @param {Object} params
 * @param {number} params.week - Week number
 * @returns {Promise<void>}
 */
export const process_all_league_format_gamelogs = async ({ week }) => {
  const { league_formats } = await get_format_hashes()

  for (const [league_format_hash, { lid }] of league_formats) {
    log(
      `Processing league format gamelogs: ${league_format_hash} (lid: ${lid})`
    )
    await generate_league_format_player_gamelogs({
      week,
      lid,
      league_format_hash
    })
  }
}

/**
 * Process all format gamelogs (scoring + league)
 * @param {Object} params
 * @param {number} params.week - Week number
 * @returns {Promise<void>}
 */
export const process_all_format_gamelogs = async ({ week }) => {
  await process_all_scoring_format_gamelogs({ week })
  await process_all_league_format_gamelogs({ week })
}

/**
 * Process scoring format seasonlogs and careerlogs for all unique scoring formats
 * @returns {Promise<void>}
 */
export const process_all_scoring_format_aggregates = async () => {
  const { scoring_format_hashes } = await get_format_hashes()

  for (const scoring_format_hash of scoring_format_hashes) {
    log(`Processing scoring format aggregates: ${scoring_format_hash}`)
    await generate_scoring_format_player_seasonlogs({ scoring_format_hash })
    await generate_scoring_format_player_careerlogs({ scoring_format_hash })
  }
}

/**
 * Process league format seasonlogs and careerlogs for all unique league formats
 * @returns {Promise<void>}
 */
export const process_all_league_format_aggregates = async () => {
  const { league_formats } = await get_format_hashes()

  for (const [league_format_hash] of league_formats) {
    log(`Processing league format aggregates: ${league_format_hash}`)
    await generate_league_format_player_seasonlogs({ league_format_hash })
    await generate_league_format_player_careerlogs({ league_format_hash })
  }
}

/**
 * Process all format aggregates (seasonlogs + careerlogs)
 * @returns {Promise<void>}
 */
export const process_all_format_aggregates = async () => {
  await process_all_scoring_format_aggregates()
  await process_all_league_format_aggregates()
}

/**
 * Process global aggregates (not format-specific)
 * - NFL team seasonlogs
 * - Basic player seasonlogs
 * - Player career game counts
 * @returns {Promise<void>}
 */
export const process_global_aggregates = async () => {
  log('Processing NFL team seasonlogs')
  await generate_nfl_team_seasonlogs()

  log('Processing player seasonlogs')
  await process_player_seasonlogs()

  log('Processing player career game counts')
  await generate_player_career_game_counts()
}

/**
 * Process all aggregates (format-specific + global)
 * @returns {Promise<void>}
 */
export const process_all_aggregates = async () => {
  await process_all_format_aggregates()
  await process_global_aggregates()
}

// ============================================================================
// Combined Pipeline Operations
// ============================================================================

/**
 * Update all format stats for a given week (gamelogs + seasonlogs + careerlogs)
 * @param {Object} params
 * @param {number} params.week - Week number
 * @returns {Promise<void>}
 */
export const update_all_format_stats = async ({ week }) => {
  await process_all_format_gamelogs({ week })
  await process_all_format_aggregates()
}
