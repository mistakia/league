/**
 * Calculate live projection by combining accumulated points with projected remaining output.
 *
 * @param {Object} params
 * @param {number} params.accumulated_points - Points accumulated so far from play-by-play
 * @param {number} params.full_game_projection - Full game projection (pre-game estimate)
 * @param {number} params.game_progress - Game progress as percentage (0-1)
 * @returns {Object} Live projection result
 * @returns {number} result.projected_total - Total projected points (accumulated + remaining)
 * @returns {number} result.remaining_projection - Projected points for remainder of game
 * @returns {number} result.accumulated_points - Points accumulated so far
 * @returns {number} result.game_progress - Game progress percentage
 */
const calculate_live_projection = ({
  accumulated_points = 0,
  full_game_projection = 0,
  game_progress = 0
}) => {
  // Validate inputs
  const safe_accumulated = Number(accumulated_points) || 0
  const safe_projection = Number(full_game_projection) || 0
  const safe_progress = Math.max(0, Math.min(1, Number(game_progress) || 0))

  // Calculate remaining fraction of the game
  const remaining_fraction = 1 - safe_progress

  // Project remaining points based on full game projection scaled by remaining time
  const remaining_projection = safe_projection * remaining_fraction

  // Total projection is accumulated + remaining
  const projected_total = safe_accumulated + remaining_projection

  return {
    projected_total: Number(projected_total.toFixed(2)),
    remaining_projection: Number(remaining_projection.toFixed(2)),
    accumulated_points: Number(safe_accumulated.toFixed(2)),
    game_progress: safe_progress
  }
}

export default calculate_live_projection
