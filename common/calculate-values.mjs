import { default_points_added, season } from './constants.mjs'

const calculateValues = ({ players, baselines, week, league = {} }) => {
  let total_vorp = 0

  for (const player of players) {
    const { pos } = player
    player.vorp[week] = default_points_added

    const historic_baseline_per_game = league[`b_${pos}`]
    if (historic_baseline_per_game) {
      const isSeasonProjection = week === 0
      const baseline = isSeasonProjection
        ? historic_baseline_per_game * (season.nflFinalWeek - 1)
        : historic_baseline_per_game

      player.vorp[week] =
        player.points[week].total - baseline || default_points_added
    } else if (baselines[pos].starter) {
      player.vorp[week] =
        player.points[week].total - baselines[pos].starter.points[week].total
    }

    if (player.vorp[week] > 0) {
      total_vorp = total_vorp + player.vorp[week]
    }
  }

  return total_vorp
}

export default calculateValues
