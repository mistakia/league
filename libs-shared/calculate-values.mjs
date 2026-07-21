import {
  default_points_added,
  current_season,
  fantasy_positions
} from '#constants'

const calculateValues = ({ players, baselines, week, league = {} }) => {
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

    const player_week_points = (player.points[week] || {}).total || null
    if (player_week_points) {
      const isSeasonProjection = week === 0
      const historic_baseline_week =
        league[`pts_base_week_${primary_position.toLowerCase()}`]
      const historic_baseline_season =
        league[`pts_base_season_${primary_position.toLowerCase()}`]
      if (isSeasonProjection && historic_baseline_season) {
        const baseline =
          historic_baseline_season * (current_season.nflFinalWeek - 1)
        player.pts_added[week] = player_week_points - baseline
      } else if (historic_baseline_week) {
        player.pts_added[week] = player_week_points - historic_baseline_week
      } else if (baselines[primary_position].starter) {
        player.pts_added[week] =
          player_week_points -
          baselines[primary_position].starter.points[week].total
      }
    }

    if (player.pts_added[week] > 0) {
      total_pts_added = total_pts_added + player.pts_added[week]
    }
  }

  return total_pts_added
}

export default calculateValues
