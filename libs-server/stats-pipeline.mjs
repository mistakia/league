import debug from 'debug'

import db from '#db'
import { create_default_league } from '#libs-shared'
import {
  named_scoring_formats,
  named_league_formats
} from '#libs-shared/named-format-catalog.mjs'
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
    .where({ is_hosted: 1 })
    .whereNull('archived_at')
    .pluck('league_id')
}

/**
 * Get every format id that requires derived player data.
 *
 * This is the union of two sources, and it MUST stay a union:
 *
 * 1. The named format catalog. These ids are addressable by any request --
 *    DEFAULT_SCORING_FORMAT_ID backs the synthetic lid=0 league that every
 *    league-less API caller resolves to -- so their derived data must exist
 *    whether or not a live league happens to use them.
 * 2. The formats of live hosted leagues, which may be long-tail uuid ids that
 *    are absent from the catalog.
 *
 * Deriving this set from live leagues alone is what silently blanked the 2025
 * season for the whole named catalog: league 1 moved onto the `genesis` format
 * for 2025, every other catalog format dropped out of the generated set, and
 * the default-league `draftkings` fallback was left with no 2025 rows.
 *
 * @returns {Promise<object>} Default league plus the scoring and league format id sets
 */
export const get_format_ids = async () => {
  const default_league = create_default_league()
  const league_ids = await get_hosted_league_ids()

  const scoring_format_ids = new Set([
    ...Object.keys(named_scoring_formats),
    default_league.scoring_format_id
  ])
  const league_format_ids = new Set([
    ...Object.keys(named_league_formats),
    default_league.league_format_id
  ])

  for (const lid of league_ids) {
    const league = await getLeague({ lid })
    scoring_format_ids.add(league.scoring_format_id)
    league_format_ids.add(league.league_format_id)
  }

  return {
    default_league,
    scoring_format_ids: Array.from(scoring_format_ids),
    league_format_ids: Array.from(league_format_ids)
  }
}

// ============================================================================
// Step Runner with Standardized Error Handling
// ============================================================================

/**
 * Run a pipeline step with timing and error handling
 * @param {object} params
 * @param {string} params.name - Step name for logging
 * @param {() => Promise<unknown>} params.fn - Async function to execute
 * @param {object} params.results - Results object to update (optional)
 * @param {boolean} params.continue_on_error - Whether to continue on error (default: true)
 * @param {(message: string) => void} params.logger - Logger function (optional)
 * @returns {Promise<object>} Result object with success, duration, error
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
 * @param {object} params
 * @param {number} params.week - Week number
 * @returns {Promise<void>}
 */
export const process_all_scoring_format_gamelogs = async ({ week }) => {
  const { scoring_format_ids } = await get_format_ids()

  for (const scoring_format_id of scoring_format_ids) {
    log(`Processing scoring format gamelogs: ${scoring_format_id}`)
    await generate_scoring_format_player_gamelogs({ week, scoring_format_id })
  }
}

/**
 * Process league format gamelogs for all unique league formats
 * @param {object} params
 * @param {number} params.week - Week number
 * @returns {Promise<void>}
 */
export const process_all_league_format_gamelogs = async ({ week }) => {
  const { league_format_ids } = await get_format_ids()

  for (const league_format_id of league_format_ids) {
    log(`Processing league format gamelogs: ${league_format_id}`)
    await generate_league_format_player_gamelogs({ week, league_format_id })
  }
}

/**
 * Process all format gamelogs (scoring + league)
 * @param {object} params
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
  const { scoring_format_ids } = await get_format_ids()

  for (const scoring_format_id of scoring_format_ids) {
    log(`Processing scoring format aggregates: ${scoring_format_id}`)
    await generate_scoring_format_player_seasonlogs({ scoring_format_id })
    await generate_scoring_format_player_careerlogs({ scoring_format_id })
  }
}

/**
 * Process league format seasonlogs and careerlogs for all unique league formats
 * @returns {Promise<void>}
 */
export const process_all_league_format_aggregates = async () => {
  const { league_format_ids } = await get_format_ids()

  for (const league_format_id of league_format_ids) {
    log(`Processing league format aggregates: ${league_format_id}`)
    await generate_league_format_player_seasonlogs({ league_format_id })
    await generate_league_format_player_careerlogs({ league_format_id })
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
 * @param {object} params
 * @param {number} params.week - Week number
 * @returns {Promise<void>}
 */
export const update_all_format_stats = async ({ week }) => {
  await process_all_format_gamelogs({ week })
  await process_all_format_aggregates()
}
