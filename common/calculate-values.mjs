import { default_points_added, season } from './constants.mjs'

const calculateValues = ({ players, baselines, week, league = {} }) => {
  let total_vorp = 0

  for (const player of players) {
    if (!player.vorp) {
      player.vorp = {}
    }

    const { pos } = player
    player.vorp[week] = default_points_added

    if (pos === 'K') {
      continue
    }

    const player_week_points = (player.points[week] || {}).total || null
    if (player_week_points) {
      const isSeasonProjection = week === 0
      const historic_baseline_week =
        league[`pts_base_week_${pos.toLowerCase()}`]
      const historic_baseline_season =
        league[`pts_base_season_${pos.toLowerCase()}`]
      if (isSeasonProjection && historic_baseline_season) {
        const baseline = historic_baseline_season * (season.nflFinalWeek - 1)
        player.vorp[week] = player_week_points - baseline
      } else if (historic_baseline_week) {
        player.vorp[week] = player_week_points - historic_baseline_week
      } else if (baselines[pos].starter) {
        player.vorp[week] =
          player_week_points - baselines[pos].starter.points[week].total
      }
    }

    if (player.vorp[week] > 0) {
      total_vorp = total_vorp + player.vorp[week]
    }
  }

  return total_vorp
}

export default calculateValues
