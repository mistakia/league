// Format resolver module
// Handle format hash resolution from various input types

import db from '#db'
import getLeague from '#libs-server/get-league.mjs'
import { named_scoring_formats } from '#libs-shared/named-scoring-formats-generated.mjs'
import { named_league_formats } from '#libs-shared/named-league-formats-generated.mjs'

/**
 * Resolve format hash from various input types (hash, league ID, or named format)
 * @param {Object} params - Parameters object
 * @param {string} [params.hash] - Direct format hash
 * @param {number} [params.lid] - League ID
 * @param {string} [params.format] - Named format
 * @param {number} [params.year] - Year for league lookup
 * @returns {Promise<{hash: string, name: string, type: string}>} Format object
 * @throws {Error} If format cannot be resolved or is not found
 */
export const resolve_format_hash = async ({ hash, lid, format, year }) => {
  // Direct hash provided
  if (hash) {
    // Check if it's a league or scoring format
    const league_format = await db('league_formats')
      .where('league_format_hash', hash)
      .first()
    if (league_format) {
      return { hash, name: `hash-${hash.slice(0, 8)}`, type: 'league' }
    }

    const scoring_format = await db('league_scoring_formats')
      .where('scoring_format_hash', hash)
      .first()
    if (scoring_format) {
      return { hash, name: `hash-${hash.slice(0, 8)}`, type: 'scoring' }
    }

    throw new Error(`Format hash '${hash}' not found in database`)
  }

  // League ID provided
  if (lid !== undefined) {
    const league = await getLeague({ lid, year })
    if (!league || !league.league_format_hash) {
      throw new Error(`No league format found for league ID ${lid}`)
    }
    return {
      hash: league.league_format_hash,
      name: `league-${lid}`,
      type: 'league'
    }
  }

  // Named format provided
  if (format) {
    // Check league formats first
    if (named_league_formats[format]) {
      return {
        hash: named_league_formats[format].hash,
        name: format,
        type: 'league'
      }
    }

    // Check scoring formats
    if (named_scoring_formats[format]) {
      return {
        hash: named_scoring_formats[format].hash,
        name: format,
        type: 'scoring'
      }
    }

    throw new Error(`Named format '${format}' not found`)
  }

  throw new Error('Must provide --hash, --lid, or --format parameter')
}
