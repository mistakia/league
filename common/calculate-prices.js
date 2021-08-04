const calculatePrices = ({ total, cap, players, week }) => {
  const rate = {}
  for (const type in total) {
    rate[type] = cap / total[type]
  }

  rate.default = (cap * 0.96) / total.default

  for (const player of players) {
    player.values_adj[week] = {}
    player.vorp_adj[week] = {}
    player.values[week] = {}
    for (const type in rate) {
      const value = Math.round(rate[type] * player.vorp[week][type])
      const diff = value - player.value
      const vorpDiff = diff / rate[type]
      const vorpAdj = player.vorp[week][type] + vorpDiff
      player.vorp_adj[week][type] = Math.max(vorpAdj, 0)
      /* eslint-disable camelcase */
      const value_adj = Math.round(rate[type] * player.vorp_adj[week][type])
      player.values[week][type] = Math.max(value, 0)
      player.values_adj[week][type] = Math.max(value_adj, 0)
      /* eslint-enable camelcase */
    }
  }

  return players
}

export default calculatePrices
