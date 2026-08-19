import debug from 'debug'

import db from '#db'

const log = debug('simulation:load-player-game-outcome-correlations')

/**
 * Load player-specific game outcome correlations.
 *
 * @param {object} params
 * @param {string[]} params.player_ids - Array of player IDs to load correlations for
 * @param {number} params.year - Year for correlation data
 * @param {string} [params.outcome_type='game_script'] - Type of outcome correlation
 * @returns {Promise<Map<string, object>>} Map of pid -> { correlation, confidence, leading_fantasy_points_per_game, trailing_fantasy_points_per_game }
 */
export async function load_player_game_outcome_correlations({
  player_ids,
  year,
  outcome_type = 'game_script'
}) {
  if (!player_ids || player_ids.length === 0) {
    return new Map()
  }

  log(
    `Loading game outcome correlations for ${player_ids.length} players, year ${year}`
  )

  // Query both current year and prior year, prefer current year
  const correlations = await db('player_game_outcome_correlations')
    .whereIn('pid', player_ids)
    .whereIn('season_year', [year, year - 1])
    .where('outcome_type', outcome_type)
    .orderBy('season_year', 'desc')
    .select(
      'pid',
      'season_year',
      'correlation',
      'confidence',
      'games_sample',
      'leading_games',
      'trailing_games',
      'leading_fantasy_points_per_game',
      'trailing_fantasy_points_per_game',
      'overall_fantasy_points_per_game'
    )

  // Deduplicate by player (prefer more recent year)
  const seen = new Set()
  const result = new Map()

  for (const row of correlations) {
    if (seen.has(row.pid)) {
      continue
    }
    seen.add(row.pid)

    result.set(row.pid, {
      correlation: parseFloat(row.correlation),
      confidence: parseFloat(row.confidence),
      games_sample: row.games_sample,
      leading_games: row.leading_games,
      trailing_games: row.trailing_games,
      leading_fantasy_points_per_game: parseFloat(
        row.leading_fantasy_points_per_game
      ),
      trailing_fantasy_points_per_game: parseFloat(
        row.trailing_fantasy_points_per_game
      ),
      overall_fantasy_points_per_game: parseFloat(
        row.overall_fantasy_points_per_game
      ),
      data_year: row.season_year
    })
  }

  log(`Loaded correlations for ${result.size} players`)

  return result
}

export default load_player_game_outcome_correlations
