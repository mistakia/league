/**
 * Load player variance and archetype data from database.
 * Historical performance data used for distribution fitting in simulation.
 */

import debug from 'debug'

import db from '#db'

const log = debug('simulation:load-player-variance')

/**
 * Load player variance data for distribution fitting.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.year - Year for variance data (typically prior year)
 * @param {string} params.scoring_format_hash - Scoring format hash
 * @returns {Promise<Map>} Map of pid -> { mean_points, std_points, coefficient_of_variation, games_played }
 */
export async function load_player_variance({
  player_ids,
  year,
  scoring_format_hash
}) {
  if (!player_ids.length) {
    return new Map()
  }

  log(`Loading variance for ${player_ids.length} players, year ${year}`)

  // First try player_variance table
  const cached_variance = await db('player_variance')
    .whereIn('pid', player_ids)
    .where({ year, scoring_format_hash })

  const variance_map = new Map()
  const found_pids = new Set()

  for (const row of cached_variance) {
    const std_points = parseFloat(row.standard_deviation)
    variance_map.set(row.pid, {
      mean_points: parseFloat(row.mean_points),
      std_points,
      coefficient_of_variation: parseFloat(row.coefficient_of_variation),
      games_played: row.games_played
    })
    found_pids.add(row.pid)
  }

  // For missing players, calculate from scoring_format_player_gamelogs
  const missing_pids = player_ids.filter((pid) => !found_pids.has(pid))

  if (missing_pids.length > 0) {
    log(`Calculating variance for ${missing_pids.length} players from gamelogs`)

    const gamelogs = await db('scoring_format_player_gamelogs')
      .join(
        'nfl_games',
        'scoring_format_player_gamelogs.esbid',
        'nfl_games.esbid'
      )
      .whereIn('scoring_format_player_gamelogs.pid', missing_pids)
      .where('nfl_games.year', year)
      .where(
        'scoring_format_player_gamelogs.scoring_format_hash',
        scoring_format_hash
      )
      .select(
        'scoring_format_player_gamelogs.pid',
        'scoring_format_player_gamelogs.points'
      )

    // Group by player and calculate stats
    const player_gamelogs = new Map()
    for (const gl of gamelogs) {
      if (!player_gamelogs.has(gl.pid)) {
        player_gamelogs.set(gl.pid, [])
      }
      player_gamelogs.get(gl.pid).push(parseFloat(gl.points))
    }

    for (const [pid, points_array] of player_gamelogs) {
      if (points_array.length === 0) continue

      const games_played = points_array.length
      const mean_points =
        points_array.reduce((sum, p) => sum + p, 0) / games_played

      let standard_deviation = 0
      if (games_played > 1) {
        const variance =
          points_array.reduce((sum, p) => sum + (p - mean_points) ** 2, 0) /
          games_played
        standard_deviation = Math.sqrt(variance)
      }

      const coefficient_of_variation =
        mean_points > 0 ? standard_deviation / mean_points : 0

      variance_map.set(pid, {
        mean_points,
        std_points: standard_deviation,
        coefficient_of_variation,
        games_played
      })
    }
  }

  log(`Loaded variance for ${variance_map.size} players`)
  return variance_map
}

/**
 * Load archetypes for players.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.year - Year of archetype data
 * @returns {Promise<Map>} Map of pid -> archetype string
 */
export async function load_player_archetypes({ player_ids, year }) {
  if (!player_ids.length) {
    return new Map()
  }

  log(`Loading archetypes for ${player_ids.length} players, year ${year}`)

  const archetypes = await db('player_archetypes')
    .whereIn('pid', player_ids)
    .where('year', year)

  const archetype_map = new Map()
  for (const row of archetypes) {
    archetype_map.set(row.pid, row.archetype)
  }

  log(`Loaded ${archetype_map.size} archetypes`)
  return archetype_map
}
