import getRosterSize from './get-roster-size.mjs'

// The discretionary cap: every team's cap, minus the minimum bid owed on every
// roster spot on every team. What remains is the money teams can actually
// choose how to spend, which is the pool calculate-prices.mjs allocates across
// the board in proportion to pts_added.
//
// This expression was open-coded at six call sites and every one of them
// computed it only to hand it straight to calculatePrices -- so it had no
// caller-side purpose and belongs with the arithmetic that consumes it. The
// seventh site, scripts/generate-league-format-player-seasonlogs.mjs,
// re-derived it as the FULL cap instead and so priced the same points added at
// a higher rate for the seven formats carrying min_bid = 1. Six correct copies
// and one wrong one is the failure mode a shared derivation removes: there is
// now no site at which a future writer re-derives this at all.
const get_discretionary_cap = (league_format) => {
  const { number_teams, salary_cap, min_bid } = league_format
  return (
    number_teams * salary_cap -
    number_teams * getRosterSize(league_format) * min_bid
  )
}

export default get_discretionary_cap
