const calculateValues = ({ players, baselines, week }) => {
  const total = {
    default: 0,
    available: 0,
    starter: 0,
    bench: 0,
    manual: 0
  }

  for (const player of players) {
    const { pos } = player
    player.vorp[week] = {
      default: -99999,
      defaultAvailable: -99999,
      available: -99999,
      starter: -99999,
      bench: -99999,
      manual: -99999
    }

    for (const type in baselines[pos]) {
      player.vorp[week][type] =
        player.points[week].total - baselines[pos][type].points[week].total

      if (player.vorp[week][type] > 0) {
        total[type] = total[type] + player.vorp[week][type]
      }
    }

    // weighted average
    const isSeasonProjection = week === 0
    player.vorp[week].default = isSeasonProjection
      ? player.vorp[week].defaultAvailable || 0
      : player.vorp[week].starter

    if (player.vorp[week].default > 0) {
      total.default = total.default + player.vorp[week].default
    }
  }

  return total
}

export default calculateValues
