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
 *
 * This decides what `--only-missing` treats as "already generated", and it is
 * PRESENCE, never completeness -- a format that holds one qualifying row is
 * skipped whatever else is missing. Staleness is owned by the
 * `scoring-format-gamelog-completeness` data check, not by this function.
 *
 * @param {object} params - Parameters object
 * @param {object} params.query - Database query object
 * @param {string} params.step_name - Name of the generation step
 * @param {string} params.table_name - Table the step writes, for join qualification
 * @returns {object} Modified query object
 */
export const build_step_query_conditions = ({
  query,
  step_name,
  table_name
}) => {
  // Seasonlogs and projections carry their own season column.
  if (step_name.includes('seasonlogs')) {
    return query
      .where('season_year', '>=', SCRIPT_CONFIG.min_year_check)
      .limit(1)
  }

  if (step_name.includes('projections')) {
    return query
      .where('season_year', current_season.last_completed_season_year)
      .limit(1)
  }

  // Gamelogs span years too -- they are per GAME. They were previously treated
  // as year-agnostic, so one row from any season, however old, read as "this
  // step has run" and `--only-missing` skipped the format forever. That is what
  // froze every format's gamelogs at whatever `player_gamelogs` held when the
  // format was first generated. The season lives on `nfl_games`, since these
  // tables key on esbid and carry no season column of their own.
  if (step_name.includes('gamelogs')) {
    return query
      .join('nfl_games', 'nfl_games.esbid', `${table_name}.esbid`)
      .where('nfl_games.season_year', '>=', SCRIPT_CONFIG.min_year_check)
      .where('nfl_games.season_type', 'REG')
      .limit(1)
  }

  // Careerlogs are genuinely year-agnostic -- one row per player per format.
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

    // Build base query and apply step-specific conditions. The format-id
    // column is qualified because the gamelogs arm joins nfl_games.
    let query = db(table_name).where(`${table_name}.${hash_column}`, format_id)
    query = build_step_query_conditions({ query, step_name, table_name })

    const result = await query.first()
    return !!result
  } catch (error) {
    // Returning false means "regenerate", which is the safe direction -- but it
    // also means a query this function can no longer express reads as missing
    // data forever, in silence. The `year` -> `season_year` conform landed in
    // exactly that state: the seasonlog and projection arms threw on every
    // call, and `--only-missing` regenerated both steps unconditionally while
    // reporting nothing. Log at warn so the next one is visible.
    console.warn(
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
