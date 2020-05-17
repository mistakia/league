import getRosterSize from './get-roster-size'

const calculateValues = ({ players, baselines, ...args }) => {
  const total = {
    available: 0,
    starter: 0,
    average: 0
  }

  for (const player of players) {
    const { pos1 } = player
    player.vorp = {}
    for (const type in baselines[pos1]) {
      player.vorp[type] = player.points.total - baselines[pos1][type].points.total
      if (player.vorp[type] > 0) {
        total[type] = total[type] + player.vorp[type]
      }
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
