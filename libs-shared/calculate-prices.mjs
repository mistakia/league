import get_discretionary_cap from './get-discretionary-cap.mjs'

// market_salary is the dollar translation of pts_added: the discretionary cap
// allocated across the board in proportion to value added.
//
//   rate = get_discretionary_cap(league_format) / total_pts_added
//
// The cap is derived HERE rather than by the caller -- number_teams * salary_cap minus
// the minimum bid on every roster spot -- so the money teams must spend simply
// filling out a roster is out of the pool, and no caller can get that
// subtraction wrong. One did: see get-discretionary-cap.mjs.
//
// The pricing_model gate lives here for the same reason. A DFS format
// (pricing_model 'dfs_fixed') publishes per-player salaries externally, so a
// market_salary derived from a contest-entry cap and number_teams = 1 is
// meaningless; pts_added stays meaningful for any format. That gate was
// open-coded at three call sites and absent from a fourth, which is how
// draftkings_classic ended up carrying a realized earned_salary on every row
// and a NULL forward market_salary for the same format. A caller cannot forget
// a gate it does not hold.
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
// answered separately by projected_positive_salary_at_available_cap in
// scripts/process-projections.mjs.

// The denominator is the sum of the POSITIVE PARTS of the aggregate being
// priced, never its raw sum.
//
// For every aggregate priced before 2026-08 the two were identical, because
// those aggregates are all non-negative -- the weekly and season paths write a
// -999 sentinel that max() maps to zero, and the drawn season surplus is
// E[max(X - baseline, 0)] by construction. That is exactly what made this
// dangerous: nothing stated the rule, no test covered it, and the first SIGNED
// variant to be priced breaks it silently. Measured on live 2026 data,
// genesis_10_team rest of season, the net aggregate sums to -41,841.3 across the
// board while its positive parts sum to 3,114.5. A raw-sum denominator gives a
// NEGATIVE rate, every price computes negative, every one hits the floor below,
// and the whole board prices at $0 -- with no error, no failing test and no
// diagnostic.
//
// It is derived HERE rather than passed in for the same reason the discretionary
// cap is. Three producers each hand-accumulated this total inside a `value > 0`
// branch, and all three independently forgot to accumulate a second one for the
// signed variant they were already computing and persisting beside it. A
// denominator the caller supplies is a denominator the caller can get wrong;
// deriving it from the aggregate key means a caller cannot price a variant
// against the wrong population, and cannot add a variant that is silently
// unpriced.
const get_positive_part_total = ({ players, aggregate_key }) => {
  let total = 0
  for (const player of players) {
    const value = player.pts_added?.[aggregate_key]
    if (Number.isFinite(value) && value > 0) {
      total += value
    }
  }
  return total
}

// `aggregate_key` is an aggregation key rather than a week number. It takes the
// numeric weeks, `0` for the season board, and the named period aggregates
// ('season', 'season_net', 'rest_of_season', 'rest_of_season_net', and the
// realized 'earned' family) -- it was called `week` while only the first of
// those was true.
const calculatePrices = ({ league_format, players, aggregate_key }) => {
  const pricing_model = league_format.pricing_model || 'auction'
  if (pricing_model !== 'auction') {
    return players
  }

  const total_pts_added = get_positive_part_total({ players, aggregate_key })

  // No player clears replacement on this aggregate, so there is nothing to
  // allocate the cap against. Leaving the board unpriced is the honest answer;
  // dividing by zero would price every player at Infinity, which `|| 0` below
  // does NOT catch. Callers that require an auction format to come out priced
  // assert on that themselves -- see generate-league-format-player-seasonlogs.
  if (!(total_pts_added > 0)) {
    return players
  }

  const pts_added_salary_rate =
    get_discretionary_cap(league_format) / total_pts_added

  for (const player of players) {
    // A player with no value on this aggregate has no price on it either, and
    // the key stays absent on both maps rather than resolving to $0. Without
    // this the arithmetic below runs on `undefined`, `Math.round(NaN) || 0`
    // floors to 0, and a player who was never in the drawn pool is stored as
    // priced-at-zero -- indistinguishable from a real player the market values
    // at nothing, which is the conflation the period tables' NULL spelling
    // exists to remove. See assign_expected_surplus and
    // calculate-player-period-values.mjs for where the absence originates.
    //
    // The weekly aggregate keys are unaffected: they carry the `-999` sentinel,
    // which is finite, prices negative and floors to 0 exactly as before.
    //
    // DELETE, DO NOT MERELY SKIP. The rows this runs on come from
    // libs-server/get-players.mjs, which is the writer's loader as well as the
    // API payload builder -- so `market_salary[aggregate_key]` arrives already
    // populated with whatever the PREVIOUS run stored. Skipping leaves that
    // stale value untouched and the writer stores it straight back, which is a
    // loop that never converges: measured on the live 2026 rest-of-season board,
    // 1,680 rows came out with the points-added correctly NULL and both salary
    // columns still holding the 0.00 the sentinel era had priced them at.
    if (!Number.isFinite(player.pts_added?.[aggregate_key])) {
      if (player.market_salary) {
        delete player.market_salary[aggregate_key]
      }
      if (player.projected_points_added_positive_including_cap_savings) {
        delete player.projected_points_added_positive_including_cap_savings[
          aggregate_key
        ]
      }
      continue
    }

    // Floor here, once, rather than on the way out. A weekly pts_added is
    // signed and the season path carries a -999 sentinel for anyone who was
    // never priced, so the raw product is negative for a large share of the
    // board -- and salary_diff below consumed that negative before anything
    // floored it. That happens to be harmless today (a negative market_salary
    // implies a negative pts_added, which drives the including-cap-savings
    // quantity negative under either ordering, and it is floored at zero too),
    // but only by an algebraic coincidence of the current formula. Flooring at
    // the definition makes the value mean the same thing everywhere it is read.
    //
    // This floor is what the `positive` token in the column name asserts, and
    // it applies to EVERY aggregate key, net included -- which is why the net
    // sibling column was dropped rather than renamed. Its name claimed a signed
    // variant that this line makes impossible.
    const market_salary = Math.max(
      Math.round(pts_added_salary_rate * player.pts_added[aggregate_key]) || 0,
      0
    )
    const salary_diff =
      typeof player.player_salary === 'undefined' ||
      player.player_salary === null
        ? 0
        : market_salary - player.player_salary

    const pts_added_from_salary_savings = salary_diff / pts_added_salary_rate
    const pts_added_including_cap_savings =
      player.pts_added[aggregate_key] + pts_added_from_salary_savings || 0

    if (!player.projected_points_added_positive_including_cap_savings) {
      player.projected_points_added_positive_including_cap_savings = {}
    }
    player.projected_points_added_positive_including_cap_savings[
      aggregate_key
    ] = Math.max(pts_added_including_cap_savings, 0)

    if (!player.market_salary) {
      player.market_salary = {}
    }
    player.market_salary[aggregate_key] = market_salary
  }

  return players
}

export default calculatePrices
