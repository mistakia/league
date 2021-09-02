const calculatePrices = ({ total, cap, players, week }) => {
  const rate = cap / total

  for (const player of players) {
    const market_salary = Math.round(rate * player.vorp[week]) || 0
    const diff =
      typeof player.value === 'undefined' || player.value === null
        ? 0
        : market_salary - player.value

    const vorpDiff = diff / rate
    const vorpAdj = player.vorp[week] + vorpDiff || 0
    player.vorp_adj[week] = Math.max(vorpAdj, 0)
    player.market_salary[week] = Math.max(market_salary, 0)

    const market_salary_adj = Math.round(rate * player.vorp_adj[week]) || 0
    player.market_salary_adj[week] = Math.max(market_salary_adj, 0)
  }

  return players
}

export default calculatePrices
