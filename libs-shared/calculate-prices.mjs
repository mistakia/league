// The $/point rate answers a DIFFERENT question than pts_added does. pts_added
// is surplus over the worst starter; market_salary is what a player will
// actually cost. This function used to answer only the first and call the answer
// the second, by assuming the whole cap is exhausted in proportion to surplus:
//
//   rate = cap / total_pts_added
//
// That makes every baseline improvement break prices, because raising the
// baseline shrinks the denominator and concentrates the same fixed pool onto
// fewer players. Correcting the baseline alone moved the top RB from $59 to
// $100 against a league whose observed ceiling is $60 -- which is what broke the
// previous attempt at the baseline fix.
//
// Real auctions do not spend the cap in proportion to surplus, because teams
// must still fill every roster spot: a large share of the cap goes to players at
// or below replacement, who have zero surplus by construction. surplus_cap_share
// is the fraction that does reach above-replacement players. It is FITTED
// against observed salaries by scripts/fit-surplus-cap-share.mjs, not tuned.
//
// Fitted 2026-08-02 by least squares of observed contract value on pts_added
// across the hosted leagues, against the calibrated projected board. Mirrors the
// league_formats.surplus_cap_share column default; used for the synthetic lid=0
// league, which has no row.
export const DEFAULT_SURPLUS_CAP_SHARE = 0.63

// Default 1 preserves the old arithmetic for any caller that does not supply a
// share, so an unfitted format prices exactly as it did before.
const calculatePrices = ({
  total_pts_added,
  cap,
  surplus_cap_share = 1,
  players,
  week
}) => {
  // pg returns numeric columns as strings, and the share reaches here straight
  // off league_formats.
  const share = Number(surplus_cap_share)
  const pts_added_salary_rate =
    (cap * (Number.isFinite(share) ? share : 1)) / total_pts_added

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
