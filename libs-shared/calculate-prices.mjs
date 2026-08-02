// market_salary is the dollar translation of pts_added: the discretionary cap
// allocated across the board in proportion to value added.
//
//   rate = cap / total_pts_added
//
// `cap` is ALREADY discretionary -- num_teams * cap minus the minimum bid on
// every roster spot -- so the money teams must spend simply filling out a roster
// is out of the pool before this function sees it.
//
// There used to be a second multiplier here, surplus_cap_share, fitted by least
// squares of observed contract value on pts_added and standing at 0.63. It is
// gone, and its removal is not a retune. Two reasons.
//
// It was fitted against observed prices, which is the one thing a valuation must
// never do -- a board that agrees with the market by construction can never tell
// you the market is wrong. Worse, the price sample it was fitted to is auction
// leftovers: 44-73 players a year against a 600-player board, systematically the
// cheap residue after keepers.
//
// And it was not measuring what it claimed. Measured against realized outcomes,
// the share of paid salary reaching above-replacement players is 0.961 (range
// 0.925-0.982 over 2020-2025), not 0.63. The gap was a broken denominator
// elsewhere: the calibrated board put only ~0.61 of a realized season's total
// points added on the board, so the $/point rate came out high and a sub-1 share
// pulled it back down. Drawing the season board from projection dispersion puts
// the denominator back on a realized season's scale, which is what makes
// spending the whole discretionary cap the right arithmetic rather than an
// overshoot.
//
// If a market-agreement objective is wanted, it belongs downstream of the board
// as a separate lens, never inside it -- and the situational question ("what
// will he actually cost given what is left in this league right now") is already
// answered separately by market_salary_adj in scripts/process-projections.mjs.
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
