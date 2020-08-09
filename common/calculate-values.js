const calculateValues = ({ players, baselines, vorpw, volsw, week }) => {
  const total = {
    available: 0,
    starter: 0,
    average: 0,
    hybrid: 0,
    bench: 0,
    manual: 0
  }

  const weightAvailable = ((vorpw !== null) ? vorpw : 1) * 0.5
  const weightStarter = ((volsw !== null) ? volsw : 1) * 0.5
  const totalWeight = weightAvailable + weightStarter

  for (const player of players) {
    const { pos1 } = player
    player.vorp[week] = {
      available: -99999,
      starter: -99999,
      bench: -99999,
      average: -99999,
      hybrid: -99999,
      manual: -99999
    }

    if (pos1 === 'K' || pos1 === 'DST') continue // TODO - ignore kickers and defenses for now

    for (const type in baselines[pos1]) {
      player.vorp[week][type] = player.points[week].total - baselines[pos1][type].points[week].total
      if (player.vorp[week][type] > 0) {
        total[type] = total[type] + player.vorp[week][type]
      }
    }
    player.vorp[week].hybrid = ((player.vorp[week].available * weightAvailable) + (player.vorp[week].starter * weightStarter)) / totalWeight
    if (player.vorp[week].hybrid > 0) {
      total.hybrid = total.hybrid + player.vorp[week].hybrid
    }
  }

  return total
}

export default calculateValues
