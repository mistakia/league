import db from '#db'
import { current_season, transaction_types } from '#constants'

/**
 * Validates that a player has not been franchise tagged for three consecutive years
 *
 * @param {Object} params - Function parameters
 * @param {string|number} params.pid - Player ID
 * @param {string|number} params.tid - Team ID
 * @param {number} [params.year] - Year to check (defaults to current season year)
 * @returns {Promise<boolean>} - True if valid (not tagged 3 consecutive years), false if invalid
 */
export default async function validate_franchise_tag({
  pid,
  tid,
  year = current_season.year
}) {
  // Check previous two years for franchise tags
  const previous_years_tags = await db('transactions')
    .where({
      tid,
      pid,
      type: transaction_types.FRANCHISE_TAG
    })
    .whereIn('year', [year - 1, year - 2])
    .orderBy('year', 'desc')

  // Invalid if there are 2 franchise tags in the past two consecutive years
  if (
    previous_years_tags.length === 2 &&
    previous_years_tags[0].year === year - 1 &&
    previous_years_tags[1].year === year - 2
  ) {
    return false
  }

  return true
}
