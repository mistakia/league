const calculatePrices = ({ total_vorp, cap, players, week }) => {
  const vorp_salary_rate = cap / total_vorp

  for (const player of players) {
    const market_salary = Math.round(vorp_salary_rate * player.vorp[week]) || 0
    const salary_diff =
      typeof player.value === 'undefined' || player.value === null
        ? 0
        : market_salary - player.value

    const vorp_from_salary_savings = salary_diff / vorp_salary_rate
    const vorp_salary_adjusted =
      player.vorp[week] + vorp_from_salary_savings || 0
    player.vorp_adj[week] = Math.max(vorp_salary_adjusted, 0)
    player.market_salary[week] = Math.max(market_salary, 0)
  }

  return players
}

export default calculatePrices
