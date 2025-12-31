import db from '#db'
import { current_season } from '#constants'

/**
 * Get playoff week configuration from the seasons table
 *
 * @param {Object} params
 * @param {number} params.lid - League ID
 * @param {number} [params.year] - Season year (defaults to current season)
 * @returns {Promise<Object>} Playoff week configuration
 *   - wildcard_week: First playoff week (wildcard round)
 *   - championship_weeks: Array of championship round weeks
 *   - final_week: Final week of the season (last championship week)
 *   - playoff_weeks: Array of all playoff weeks
 */
const get_season_playoff_weeks = async ({
  lid,
  year = current_season.year
}) => {
  const season = await db('seasons').where({ lid, year }).first()

  if (!season) {
    return {
      wildcard_week: null,
      championship_weeks: [],
      final_week: null,
      playoff_weeks: []
    }
  }

  const wildcard_week = season.wildcard_round || null
  const championship_weeks = Array.isArray(season.championship_round)
    ? season.championship_round
    : season.championship_round
      ? [season.championship_round]
      : []

  const final_week =
    championship_weeks.length > 0 ? Math.max(...championship_weeks) : null

  const playoff_weeks = wildcard_week
    ? [wildcard_week, ...championship_weeks]
    : [...championship_weeks]

  return {
    wildcard_week,
    championship_weeks,
    final_week,
    playoff_weeks
  }
}

export default get_season_playoff_weeks
