const calculateValues = ({
  players,
  baselines,
  vorpw = 1,
  volsw = 1,
  week
}) => {
  const total = {
    default: 0,
    available: 0,
    starter: 0,
    average: 0,
    hybrid: 0,
    bench: 0,
    manual: 0
  }

  const weightAvailable = vorpw === null ? 1 : vorpw
  const weightStarter = volsw === null ? 1 : volsw
  const totalWeight = weightAvailable + weightStarter

  for (const player of players) {
    const { pos } = player
    player.vorp[week] = {
      default: -99999,
      available: -99999,
      starter: -99999,
      bench: -99999,
      average: -99999,
      hybrid: -99999,
      manual: -99999
    }

    for (const type in baselines[pos]) {
      player.vorp[week][type] =
        player.points[week].total - baselines[pos][type].points[week].total
      if (player.vorp[week][type] > 0) {
        total[type] = total[type] + player.vorp[week][type]
      }
    }

    // weighted average based on user weights
    player.vorp[week].hybrid =
      (player.vorp[week].available * weightAvailable +
        player.vorp[week].starter * weightStarter) /
      totalWeight
    if (player.vorp[week].hybrid > 0) {
      total.hybrid = total.hybrid + player.vorp[week].hybrid
    }

    // weighted average
    player.vorp[week].default = player.vorp[week].defaultAvailable

    if (player.vorp[week].default > 0) {
      total.default = total.default + player.vorp[week].default
    }
  }

  return total
}

export default calculateValues
