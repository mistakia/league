const calculatePrices = ({ total, cap, players, week }) => {
  const rate = {}
  for (const type in total) {
    rate[type] = cap / total[type]
  }

  for (const player of players) {
    player.values[week] = {}
    for (const type in rate) {
      const value = Math.round(rate[type] * player.vorp[week][type])
      player.values[week][type] = value > 0 ? value : 0
    }
  }

  return players
}

export default calculatePrices
