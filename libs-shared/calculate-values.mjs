import { default_points_added, fantasy_positions } from '#constants'
import { get_player_week_total } from './get-player-week-points.mjs'

// pts_added is SURPLUS: points above the worst player who starts at the
// position, derived from the same board the player is scored on by
// calculateBaselines. It is deliberately not a price -- see calculate-prices.mjs
// for the second, separately fitted question.
//
// This used to prefer a stored league_formats.pts_base_* constant, measured by
// running the optimizer over REALIZED seasons and multiplying the per-game
// figure back up by 17. That mismatched units at every position: a realized
// 10th-best season is a selection maximum over a noisy distribution, while a
// projection is regressed toward the mean, so subtracting the first from the
// second biased every pts_added downward -- far enough at DST that all 32
// defenses priced at $0.00. The columns are gone; the board is its own baseline.
const calculateValues = ({ players, baselines, week }) => {
  let total_pts_added = 0

  for (const player of players) {
    if (!player.pts_added) {
      player.pts_added = {}
    }

    const { primary_position } = player
    player.pts_added[week] = default_points_added

    if (primary_position === 'K') {
      continue
    }

    if (!fantasy_positions.includes(primary_position)) {
      continue
    }

    const player_week_points = get_player_week_total({ player, week })
    if (player_week_points && baselines[primary_position].starter) {
      player.pts_added[week] =
        player_week_points -
        baselines[primary_position].starter.points[week].total
    }

    if (player.pts_added[week] > 0) {
      total_pts_added = total_pts_added + player.pts_added[week]
    }
  }

  return total_pts_added
}

export default calculateValues
