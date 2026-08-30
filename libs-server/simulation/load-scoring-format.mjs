// @ts-check
/**
 * Load a league scoring format for simulation point calculation.
 */

import db from '#db'

/**
 * Load scoring format by hash.
 *
 * @param {object} params
 * @param {string} params.scoring_format_id - Scoring format hash
 * @returns {Promise<import('#db/schema-types.js').LeagueScoringFormatsRow>} Scoring format configuration
 */
export async function load_scoring_format({ scoring_format_id }) {
  const scoring_format = await db('league_scoring_formats')
    .where({ id: scoring_format_id })
    .first()

  if (!scoring_format) {
    throw new Error(`Scoring format not found: ${scoring_format_id}`)
  }

  return scoring_format
}
