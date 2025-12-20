import debug from 'debug'

import db from '#db'

const log = debug('simulation:load-position-game-outcome-defaults')

/**
 * Load position/archetype default correlations for game outcomes.
 *
 * @param {Object} params
 * @param {number} params.year - Year for default data
 * @param {string} [params.outcome_type='game_script'] - Type of outcome correlation
 * @returns {Promise<Map>} Map of 'pos' or 'pos:archetype' -> default_correlation
 */
export async function load_position_game_outcome_defaults({
  year,
  outcome_type = 'game_script'
}) {
  log(`Loading position game outcome defaults for year ${year}`)

  // Query both current year and prior year, prefer current year
  const defaults = await db('position_game_outcome_defaults')
    .whereIn('year', [year, year - 1])
    .where('outcome_type', outcome_type)
    .orderBy('year', 'desc')
    .select('pos', 'archetype', 'year', 'default_correlation', 'sample_size')

  // Build result map, deduplicate by key (prefer more recent year)
  const seen = new Set()
  const result = new Map()

  for (const row of defaults) {
    const key = row.archetype ? `${row.pos}:${row.archetype}` : row.pos

    if (seen.has(key)) {
      continue
    }
    seen.add(key)

    result.set(key, {
      default_correlation: parseFloat(row.default_correlation),
      sample_size: row.sample_size,
      data_year: row.year
    })
  }

  log(`Loaded ${result.size} position/archetype defaults`)

  return result
}

/**
 * Get the default correlation for a player based on position and archetype.
 *
 * @param {Object} params
 * @param {Map} params.defaults_map - Map from load_position_game_outcome_defaults
 * @param {string} params.pos - Player position
 * @param {string} [params.archetype] - Player archetype (optional)
 * @returns {number|null} Default correlation or null if not found
 */
export function get_position_default_correlation({
  defaults_map,
  pos,
  archetype
}) {
  // Try archetype-specific default first
  if (archetype) {
    const archetype_key = `${pos}:${archetype}`
    const archetype_default = defaults_map.get(archetype_key)
    if (archetype_default) {
      return archetype_default.default_correlation
    }
  }

  // Fall back to position-only default
  const position_default = defaults_map.get(pos)
  if (position_default) {
    return position_default.default_correlation
  }

  return null
}

export default load_position_game_outcome_defaults
