// Data checker module
// Handle data existence and safety checking operations

import db from '#db'
import { current_season } from '#constants'
import {
  named_scoring_formats,
  named_league_formats
} from '#libs-shared/named-format-catalog.mjs'

import { generation_scripts, SCRIPT_CONFIG } from './config.mjs'

/**
 * Check if a format exists in the database
 * @param {object} params - Parameters object
 * @param {string} params.format_id - Hash of the format to check
 * @param {string} params.format_type - Type of format ('scoring' or 'league')
 * @returns {Promise<boolean>}
 */
export const check_format_exists = async ({ format_id, format_type }) => {
  try {
    if (format_type === 'scoring') {
      const result = await db('league_scoring_formats')
        .where('id', format_id)
        .first()
      return !!result
    } else if (format_type === 'league') {
      const result = await db('league_formats').where('id', format_id).first()
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
 * @param {object} params - Parameters object
 * @param {object} params.query - Database query object
 * @param {string} params.step_name - Name of the generation step
 * @returns {object} Modified query object
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
    return query.where('year', current_season.stats_season_year).limit(1)
  } else if (step_name === 'league_format_draft_values') {
    return query.limit(1)
  }
  return query
}

/**
 * Check if data exists for a format in a specific table
 * @param {object} params - Parameters object
 * @param {string} params.format_id - Hash of the format
 * @param {string} params.format_type - Type of format ('scoring' or 'league')
 * @param {string} params.step_name - Name of the generation step
 * @returns {Promise<boolean>}
 */
export const check_format_data_exists = async ({
  format_id,
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
      format_type === 'scoring' ? 'scoring_format_id' : 'league_format_id'

    // Build base query and apply step-specific conditions
    let query = db(table_name).where(hash_column, format_id)
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
 * @param {object} params - Parameters object
 * @param {string} params.format_id - Format hash to check
 * @returns {Promise<boolean>}
 */
export const check_removal_safety = async ({ format_id }) => {
  const active_season_count = await db('seasons')
    .where('league_format_id', format_id)
    .count('* as count')
    .first()

  return active_season_count.count === 0
}

/**
 * Check if a scoring format can be safely removed
 *
 * This gate and its league-format sibling stand in front of an unconditional
 * delete of a format's entire derived history, so both fail CLOSED: a check
 * that could not answer pushes a reason and blocks the removal. Every catch
 * here used to `console.warn` and fall through, which left `reasons` empty --
 * byte-identical to "verified unused", and the more dangerous half of a defect
 * that made both gates inert for as long as they have existed.
 *
 * The other half was the parameter name. Both call sites in cleanup-manager
 * passed `format_hash` while both functions destructure `format_id`, so
 * `format_id` was `undefined`: the named-format comparison could never match,
 * and each usage query bound undefined and threw straight into the swallowing
 * catch. Measured 2026-08-14 -- every orphaned format was reported `safe: true`
 * with an empty reason list, including ones the classifier had only cleared on
 * its own separate (and working) usage check. Nothing downstream noticed,
 * because a safety gate that always passes looks exactly like a safe corpus.
 *
 * @param {object} params - Parameters object
 * @param {string} params.format_id - Scoring format id to check
 * @returns {Promise<{safe: boolean, reasons: string[]}>} Safety check result
 */
export const check_scoring_format_removal_safety = async ({ format_id }) => {
  const reasons = []

  // Check if it's a named format
  if (named_scoring_formats) {
    const is_named = Object.values(named_scoring_formats).some(
      (f) => f.id === format_id
    )
    if (is_named) reasons.push('Format is a named scoring format')
  }

  // Check if used by league formats
  try {
    const league_format_usage = await db('league_formats')
      .where('scoring_format_id', format_id)
      .count('* as count')
      .first()
    if (league_format_usage && league_format_usage.count > 0) {
      reasons.push(`Used by ${league_format_usage.count} league formats`)
    }
  } catch (error) {
    // Fail CLOSED -- see the note on the league-format check below.
    reasons.push(`Could not check league format usage: ${error.message}`)
  }

  // Check if used in active seasons
  try {
    const season_usage = await db('seasons')
      .where('scoring_format_id', format_id)
      .count('* as count')
      .first()
    if (season_usage && season_usage.count > 0) {
      reasons.push(`Used by ${season_usage.count} active seasons`)
    }
  } catch (error) {
    // Fail CLOSED -- see the note on check_scoring_format_removal_safety.
    reasons.push(`Could not check season usage: ${error.message}`)
  }

  return {
    safe: reasons.length === 0,
    reasons
  }
}

/**
 * Check if a league format can be safely removed
 * @param {object} params - Parameters object
 * @param {string} params.format_id - League format hash to check
 * @returns {Promise<{safe: boolean, reasons: string[]}>} Safety check result
 */
export const check_league_format_removal_safety = async ({ format_id }) => {
  const reasons = []

  // Check if it's a named format
  if (named_league_formats) {
    const is_named = Object.values(named_league_formats).some(
      (f) => f.id === format_id
    )
    if (is_named) reasons.push('Format is a named league format')
  }

  // Check if used in active seasons
  try {
    const season_usage = await db('seasons')
      .where('league_format_id', format_id)
      .count('* as count')
      .first()
    if (season_usage && season_usage.count > 0) {
      reasons.push(`Used by ${season_usage.count} active seasons`)
    }
  } catch (error) {
    // Fail CLOSED -- see the note on check_scoring_format_removal_safety.
    reasons.push(`Could not check season usage: ${error.message}`)
  }

  return {
    safe: reasons.length === 0,
    reasons
  }
}
