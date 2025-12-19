/**
 * Unified correlation loading functions.
 * Consolidates the various correlation loading patterns into a single flexible function.
 */

import debug from 'debug'

import db from '#db'

const log = debug('simulation:load-correlations')

/**
 * Load correlations with flexible options.
 * Supports loading within a single player set or between two sets.
 *
 * @param {Object} params
 * @param {string[]} [params.player_ids] - Single set of player IDs (for within-set queries)
 * @param {string[]} [params.player_set_a] - First set of player IDs (for between-set queries)
 * @param {string[]} [params.player_set_b] - Second set of player IDs (for between-set queries)
 * @param {number} params.year - Primary year for correlation data
 * @param {boolean} [params.include_prior_year=true] - Also query prior year and prefer more recent
 * @param {number} [params.min_games_together=0] - Minimum games for valid correlation
 * @param {number} [params.min_correlation=0] - Minimum absolute correlation to include
 * @param {string} [params.relationship_type] - Optional filter: 'same_team' or 'cross_team_same_game'
 * @param {string} [params.output_format='array'] - 'array' returns array of records, 'map' returns Map keyed by pid pair
 * @returns {Promise<Array|Map>} Correlations in requested format
 */
export async function load_correlations({
  player_ids,
  player_set_a,
  player_set_b,
  year,
  include_prior_year = true,
  min_games_together = 0,
  min_correlation = 0,
  relationship_type,
  output_format = 'array'
}) {
  // Determine query mode based on provided parameters
  const is_between_sets = player_set_a && player_set_b
  const is_within_set = player_ids && !is_between_sets

  if (!is_between_sets && !is_within_set) {
    log('No player IDs provided, returning empty result')
    return output_format === 'map' ? new Map() : []
  }

  // For within-set, need at least 2 players
  if (is_within_set && player_ids.length < 2) {
    return output_format === 'map' ? new Map() : []
  }

  // For between-sets, both sets must have players
  if (
    is_between_sets &&
    (player_set_a.length === 0 || player_set_b.length === 0)
  ) {
    return output_format === 'map' ? new Map() : []
  }

  const years_to_query = include_prior_year ? [year, year - 1] : [year]

  // Convert arrays to Sets for O(1) lookups in the filter loop
  const player_ids_set = is_within_set ? new Set(player_ids) : null
  const player_set_a_lookup = is_between_sets ? new Set(player_set_a) : null
  const player_set_b_lookup = is_between_sets ? new Set(player_set_b) : null

  log(
    `Loading correlations: mode=${is_within_set ? 'within' : 'between'}, ` +
      `players=${is_within_set ? player_ids.length : `${player_set_a.length}x${player_set_b.length}`}, ` +
      `years=${years_to_query.join(',')}`
  )

  // Build query
  let query = db('player_pair_correlations')
    .whereIn('year', years_to_query)
    .orderBy('year', 'desc') // Prefer more recent year

  if (is_within_set) {
    // Both players must be in the set
    query = query.whereIn('pid_a', player_ids).whereIn('pid_b', player_ids)
  } else {
    // Between two sets: match pairs where one is in set A and one is in set B
    query = query
      .where(function () {
        this.whereIn('pid_a', player_set_a).orWhereIn('pid_b', player_set_a)
      })
      .where(function () {
        this.whereIn('pid_a', player_set_b).orWhereIn('pid_b', player_set_b)
      })
  }

  if (relationship_type) {
    query = query.where('relationship_type', relationship_type)
  }

  if (min_games_together > 0) {
    query = query.where('games_together', '>=', min_games_together)
  }

  const correlations = await query

  // Deduplicate by player pair (keep more recent year due to orderBy)
  const seen_pairs = new Set()
  const results = []

  for (const row of correlations) {
    // For within-set queries, ensure both players are actually in our set
    if (is_within_set) {
      if (!player_ids_set.has(row.pid_a) || !player_ids_set.has(row.pid_b)) {
        continue
      }
    }

    // For between-set queries, ensure we have one from each set
    if (is_between_sets) {
      const a_in_set_a = player_set_a_lookup.has(row.pid_a)
      const a_in_set_b = player_set_b_lookup.has(row.pid_a)
      const b_in_set_a = player_set_a_lookup.has(row.pid_b)
      const b_in_set_b = player_set_b_lookup.has(row.pid_b)

      // Need one player from each set (not both from same set)
      const valid_pairing =
        (a_in_set_a && b_in_set_b) || (a_in_set_b && b_in_set_a)
      if (!valid_pairing) {
        continue
      }
    }

    const pair_key = `${row.pid_a}:${row.pid_b}`
    if (seen_pairs.has(pair_key)) {
      continue
    }
    seen_pairs.add(pair_key)

    const correlation_value = parseFloat(row.correlation)

    // Filter by minimum correlation if specified
    if (min_correlation > 0 && Math.abs(correlation_value) < min_correlation) {
      continue
    }

    results.push({
      pid_a: row.pid_a,
      pid_b: row.pid_b,
      correlation: correlation_value,
      games_together: row.games_together,
      team_a: row.team_a,
      team_b: row.team_b,
      relationship_type: row.relationship_type,
      data_year: row.year
    })
  }

  log(`Loaded ${results.length} correlation pairs`)

  // Return in requested format
  if (output_format === 'map') {
    const correlation_map = new Map()
    for (const row of results) {
      const cache_key = `${row.pid_a}:${row.pid_b}`
      correlation_map.set(cache_key, {
        correlation: row.correlation,
        games_together: row.games_together,
        team_a: row.team_a,
        team_b: row.team_b,
        relationship_type: row.relationship_type
      })
    }
    return correlation_map
  }

  return results
}

/**
 * Load correlations for a set of players, returning a Map for simulation cache.
 * Convenience wrapper for the common simulation use case.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.year - Year of correlation data (typically prior year)
 * @returns {Promise<Map>} Map of 'pid_a:pid_b' -> correlation data
 */
export async function load_correlations_for_players({ player_ids, year }) {
  return load_correlations({
    player_ids,
    year,
    include_prior_year: false, // Original function used single year
    output_format: 'map'
  })
}

/**
 * Load correlations between two player sets with year fallback.
 * Convenience wrapper for cross-team analysis.
 *
 * @param {Object} params
 * @param {string[]} params.player_set_a - First set of player IDs
 * @param {string[]} params.player_set_b - Second set of player IDs
 * @param {number} params.year - Current year
 * @param {string} [params.relationship_type] - Optional filter
 * @param {number} [params.min_correlation=0] - Minimum absolute correlation
 * @returns {Promise<Object[]>} Array of correlation records with data_year field
 */
export async function load_correlations_between_sets({
  player_set_a,
  player_set_b,
  year,
  relationship_type,
  min_correlation = 0
}) {
  return load_correlations({
    player_set_a,
    player_set_b,
    year,
    include_prior_year: true,
    relationship_type,
    min_correlation,
    output_format: 'array'
  })
}

/**
 * Load correlations within a single player set with year fallback.
 * Convenience wrapper for same-team correlation analysis.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Player IDs to find correlations between
 * @param {number} params.year - Current year
 * @param {string} [params.relationship_type] - Optional filter
 * @param {number} [params.min_correlation=0] - Minimum absolute correlation
 * @returns {Promise<Object[]>} Array of correlation records
 */
export async function load_correlations_within_set({
  player_ids,
  year,
  relationship_type,
  min_correlation = 0
}) {
  return load_correlations({
    player_ids,
    year,
    include_prior_year: true,
    relationship_type,
    min_correlation,
    output_format: 'array'
  })
}

/**
 * Load correlations with smart year selection.
 * Queries both current and prior year, preferring data with more games together.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.year - Current year
 * @param {number} [params.min_games_together=3] - Minimum games for valid correlation
 * @returns {Promise<Map>} Map of 'pid_a:pid_b' -> correlation data
 */
export async function load_correlations_smart({
  player_ids,
  year,
  min_games_together = 3
}) {
  return load_correlations({
    player_ids,
    year,
    include_prior_year: true,
    min_games_together,
    output_format: 'map'
  })
}
