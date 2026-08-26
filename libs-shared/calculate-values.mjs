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
// Writes pts_added onto the player rows and returns nothing. It used to return
// the positive-part total as well, for the caller to hand to calculatePrices --
// which is now derived there from the aggregate key, so no caller can price an
// aggregate against another one's denominator. See calculate-prices.mjs.
const calculateValues = ({ players, baselines, week }) => {
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

    const player_week_points = get_player_week_total({
      player,
      points_key: week
    })
    if (player_week_points && baselines[primary_position].starter) {
      player.pts_added[week] =
        player_week_points -
        baselines[primary_position].starter.points[week].total
    }
  }
}

export default calculateValues
