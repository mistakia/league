// Data checker module
// Handle data existence and safety checking operations

import db from '#db'
import { constants } from '#libs-shared'
import { named_scoring_formats } from '#libs-shared/named-scoring-formats-generated.mjs'
import { named_league_formats } from '#libs-shared/named-league-formats-generated.mjs'

import { generation_scripts, SCRIPT_CONFIG } from './config.mjs'

/**
 * Check if a format exists in the database
 * @param {Object} params - Parameters object
 * @param {string} params.format_hash - Hash of the format to check
 * @param {string} params.format_type - Type of format ('scoring' or 'league')
 * @returns {Promise<boolean>}
 */
export const check_format_exists = async ({ format_hash, format_type }) => {
  try {
    if (format_type === 'scoring') {
      const result = await db('league_scoring_formats')
        .where('scoring_format_hash', format_hash)
        .first()
      return !!result
    } else if (format_type === 'league') {
      const result = await db('league_formats')
        .where('league_format_hash', format_hash)
        .first()
      return !!result
    }
    return false
  } catch (error) {
    console.warn(`Warning: Could not check format existence: ${error.message}`)
    return true // Assume it exists to proceed
  }
}

/**
 * Build query conditions based on step type
 * @param {Object} params - Parameters object
 * @param {Object} params.query - Database query object
 * @param {string} params.step_name - Name of the generation step
 * @returns {Object} Modified query object
 */
export const build_step_query_conditions = ({ query, step_name }) => {
  if (step_name.includes('gamelogs')) {
    return query.limit(1)
  } else if (step_name.includes('seasonlogs')) {
    // Check if we have data for recent years
    return query.where('year', '>=', SCRIPT_CONFIG.min_year_check).limit(1)
  } else if (step_name.includes('careerlogs')) {
    return query.limit(1)
  } else if (step_name.includes('projections')) {
    // Check for projections using the last year with stats
    return query.where('year', constants.season.stats_season_year).limit(1)
  } else if (step_name === 'league_format_draft_values') {
    return query.limit(1)
  }
  return query
}

/**
 * Check if data exists for a format in a specific table
 * @param {Object} params - Parameters object
 * @param {string} params.format_hash - Hash of the format
 * @param {string} params.format_type - Type of format ('scoring' or 'league')
 * @param {string} params.step_name - Name of the generation step
 * @returns {Promise<boolean>}
 */
export const check_format_data_exists = async ({
  format_hash,
  format_type,
  step_name
}) => {
  const config = generation_scripts[step_name]
  if (!config || !config.tables || config.tables.length === 0) {
    return false
  }

  try {
    // Check the primary table for this step
    const table_name = config.tables[0]
    const hash_column =
      format_type === 'scoring' ? 'scoring_format_hash' : 'league_format_hash'

    // Build base query and apply step-specific conditions
    let query = db(table_name).where(hash_column, format_hash)
    query = build_step_query_conditions({ query, step_name })

    const result = await query.first()
    return !!result
  } catch (error) {
    // Table might not exist or other DB error
    console.debug(
      `Could not check data existence for ${step_name}: ${error.message}`
    )
    return false
  }
}

/**
 * Check if format data removal is safe
 * @param {Object} params - Parameters object
 * @param {string} params.format_hash - Format hash to check
 * @returns {Promise<boolean>}
 */
export const check_removal_safety = async ({ format_hash }) => {
  const active_season_count = await db('seasons')
    .where('league_format_hash', format_hash)
    .count('* as count')
    .first()

  return active_season_count.count === 0
}

/**
 * Check if a scoring format can be safely removed
 * @param {Object} params - Parameters object
 * @param {string} params.format_hash - Scoring format hash to check
 * @returns {Promise<{safe: boolean, reasons: string[]}>} Safety check result
 */
export const check_scoring_format_removal_safety = async ({ format_hash }) => {
  const reasons = []

  // Check if it's a named format
  if (named_scoring_formats) {
    const is_named = Object.values(named_scoring_formats).some(
      (f) => f.hash === format_hash
    )
    if (is_named) reasons.push('Format is a named scoring format')
  }

  // Check if used by league formats
  try {
    const league_format_usage = await db('league_formats')
      .where('scoring_format_hash', format_hash)
      .count('* as count')
      .first()
    if (league_format_usage && league_format_usage.count > 0) {
      reasons.push(`Used by ${league_format_usage.count} league formats`)
    }
  } catch (error) {
    console.warn(`Could not check league format usage: ${error.message}`)
  }

  // Check if used in active seasons
  try {
    const season_usage = await db('seasons')
      .where('scoring_format_hash', format_hash)
      .count('* as count')
      .first()
    if (season_usage && season_usage.count > 0) {
      reasons.push(`Used by ${season_usage.count} active seasons`)
    }
  } catch (error) {
    console.warn(`Could not check season usage: ${error.message}`)
  }

  return {
    safe: reasons.length === 0,
    reasons
  }
}

/**
 * Check if a league format can be safely removed
 * @param {Object} params - Parameters object
 * @param {string} params.format_hash - League format hash to check
 * @returns {Promise<{safe: boolean, reasons: string[]}>} Safety check result
 */
export const check_league_format_removal_safety = async ({ format_hash }) => {
  const reasons = []

  // Check if it's a named format
  if (named_league_formats) {
    const is_named = Object.values(named_league_formats).some(
      (f) => f.hash === format_hash
    )
    if (is_named) reasons.push('Format is a named league format')
  }

  // Check if used in active seasons
  try {
    const season_usage = await db('seasons')
      .where('league_format_hash', format_hash)
      .count('* as count')
      .first()
    if (season_usage && season_usage.count > 0) {
      reasons.push(`Used by ${season_usage.count} active seasons`)
    }
  } catch (error) {
    console.warn(`Could not check season usage: ${error.message}`)
  }

  return {
    safe: reasons.length === 0,
    reasons
  }
}
