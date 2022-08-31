import { default_points_added, season } from './constants.mjs'

const calculateValues = ({ players, baselines, week, historicBaselines }) => {
  let total = 0

  for (const player of players) {
    const { pos } = player
    player.vorp[week] = default_points_added

    if (historicBaselines[pos]) {
      const isSeasonProjection = week === 0
      const baseline = isSeasonProjection
        ? historicBaselines[pos] * season.finalWeek
        : historicBaselines[pos]
      player.vorp[week] =
        player.points[week].total - baseline || default_points_added
    } else if (baselines[pos].starter) {
      player.vorp[week] =
        player.points[week].total - baselines[pos].starter.points[week].total
    }

    if (player.vorp[week] > 0) {
      total = total + player.vorp[week]
    }
  }

  return total
}

export default calculateValues
