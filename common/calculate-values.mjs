const defaultValue = -999

const calculateValues = ({ players, baselines, week }) => {
  const isSeasonProjection = week === 0
  let total = 0

  for (const player of players) {
    const { pos } = player
    player.vorp[week] = defaultValue

    if (isSeasonProjection) {
      player.vorp[week] =
        player.points[week].total -
          baselines[pos].historical.points[week].total || defaultValue
    } else {
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
