const calculatePrices = ({ total_pts_added, cap, players, week }) => {
  const pts_added_salary_rate = cap / total_pts_added

  for (const player of players) {
    const market_salary =
      Math.round(pts_added_salary_rate * player.pts_added[week]) || 0
    const salary_diff =
      typeof player.value === 'undefined' || player.value === null
        ? 0
        : market_salary - player.value

    const pts_added_from_salary_savings = salary_diff / pts_added_salary_rate
    const pts_added_salary_adjusted =
      player.pts_added[week] + pts_added_from_salary_savings || 0

    if (!player.salary_adj_pts_added) {
      player.salary_adj_pts_added = {}
    }
    player.salary_adj_pts_added[week] = Math.max(pts_added_salary_adjusted, 0)

    if (!player.market_salary) {
      player.market_salary = {}
    }
    player.market_salary[week] = Math.max(market_salary, 0)
  }

  return players
}

export default calculatePrices
