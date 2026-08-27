// Data checker module
// Handle data existence and safety checking operations

import db from '#db'
import { current_season } from '#constants'
import {
  named_scoring_formats,
  named_league_formats
} from '#libs-shared/named-format-catalog.mjs'

import { generation_scripts, SCRIPT_CONFIG } from './config.mjs'

const format_type_tables = {
  scoring: 'league_scoring_formats',
  league: 'league_formats'
}

/**
 * Check if a format exists in the database
 * @param {object} params - Parameters object
 * @param {string} params.format_id - Id of the format to check
 * @param {string} params.format_type - Type of format ('scoring' or 'league')
 * @returns {Promise<boolean>}
 */
export const check_format_exists = async ({ format_id, format_type }) => {
  const table_name = format_type_tables[format_type]
  if (!table_name) {
    return false
  }

  const result = await db(table_name).where('id', format_id).first()
  return Boolean(result)
}

/**
 * Build query conditions based on step type
 * @param {object} params - Parameters object
 * @param {object} params.query - Database query object
 * @param {string} params.step_name - Name of the generation step
 * @returns {object} Modified query object
 */
export const build_step_query_conditions = ({ query, step_name }) => {
  // Seasonlogs and projections span years, so a row from an old year is not
  // evidence the step has run; every other step's tables are year-agnostic.
  if (step_name.includes('seasonlogs')) {
    return query.where('year', '>=', SCRIPT_CONFIG.min_year_check).limit(1)
  }

  if (step_name.includes('projections')) {
    return query
      .where('year', current_season.last_completed_season_year)
      .limit(1)
  }

  return query.limit(1)
}

/**
 * Check if data exists for a format in a specific table
 * @param {object} params - Parameters object
 * @param {string} params.format_id - Id of the format
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
  // Only per-format steps write tables carrying a format id column; asking
  // whether a format has data in any other step's tables is meaningless.
  if (!config || !config.per_format) {
    return false
  }

  try {
    // A step's tables are all written by the same script invocation, so the
    // first one answers whether that step has run for this format.
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
 * Check if a scoring format can be safely removed
 *
 * This gate and its league-format sibling stand in front of an unconditional
 * delete of a format's entire derived history, so both fail CLOSED: a check
 * that could not answer pushes a reason and blocks the removal. Never turn a
 * catch here back into a warn-and-continue -- an empty `reasons` list is
 * byte-identical to "verified unused" and makes the gate silently inert.
 *
 * @param {object} params - Parameters object
 * @param {string} params.format_id - Scoring format id to check
 * @returns {Promise<{safe: boolean, reasons: string[]}>} Safety check result
 */
export const check_scoring_format_removal_safety = async ({ format_id }) => {
  const reasons = []

  const is_named = Object.values(named_scoring_formats).some(
    (f) => f.id === format_id
  )
  if (is_named) reasons.push('Format is a named scoring format')

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
    // Fail CLOSED -- see the note on check_scoring_format_removal_safety.
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
 *
 * Fails CLOSED -- see the note on check_scoring_format_removal_safety.
 *
 * @param {object} params - Parameters object
 * @param {string} params.format_id - League format id to check
 * @returns {Promise<{safe: boolean, reasons: string[]}>} Safety check result
 */
export const check_league_format_removal_safety = async ({ format_id }) => {
  const reasons = []

  const is_named = Object.values(named_league_formats).some(
    (f) => f.id === format_id
  )
  if (is_named) reasons.push('Format is a named league format')

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
