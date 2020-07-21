import getRosterSize from './get-roster-size'

const calculateValues = ({ players, baselines, vorpw, volsw, ...args }) => {
  const total = {
    available: 0,
    starter: 0,
    average: 0,
    hybrid: 0,
    manual: 0
  }

  const weightAvailable = ((vorpw !== null) ? vorpw : 1) * 0.5
  const weightStarter = ((volsw !== null) ? volsw : 1) * 0.5
  const totalWeight = weightAvailable + weightStarter

  for (const player of players) {
    const { pos1 } = player
    player.vorp = {
      available: -99999,
      starter: -99999,
      average: -99999,
      hybrid: -99999,
      manual: -99999
    }
    for (const type in baselines[pos1]) {
      player.vorp[type] = player.points.total - (baselines[pos1][type] ? baselines[pos1][type].points.total : 0)
      if (player.vorp[type] > 0) {
        total[type] = total[type] + player.vorp[type]
      }
    }
    player.vorp.hybrid = ((player.vorp.available * weightAvailable) + (player.vorp.starter * weightStarter)) / totalWeight
    if (player.vorp.hybrid > 0) {
      total.hybrid = total.hybrid + player.vorp.hybrid
    }
  }

  const { nteams, cap } = args
  const rosterSize = getRosterSize(args)
  const leagueCap = (nteams * cap) - (nteams * rosterSize)
  const rate = {}
  for (const type in total) {
    rate[type] = leagueCap / total[type]
  }

  for (const player of players) {
    player.values = {}
    for (const type in rate) {
      const value = Math.round(rate[type] * player.vorp[type])
      player.values[type] = value > 0 ? value : 0
    }
  }

  return players
}

export default calculateValues
