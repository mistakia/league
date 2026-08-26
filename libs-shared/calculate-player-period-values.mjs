import calculatePrices from './calculate-prices.mjs'
import { current_season, default_points_added } from '#constants'

// The two non-week projection periods, and the aggregate keys they publish onto
// `player.pts_added`. They are named rather than written as bare strings because
// each one is a PERIOD paired with a VARIANT, and collapsing either axis into a
// literal is what let the period sentinels accumulate in the `week` column that
// the dedicated period tables now replace.
//
// The season POSITIVE variant is not here. It is the drawn season board --
// E[max(X - baseline, 0)] over seasons sampled from each player's projection
// dispersion -- and it is published under `season_aggregate_key` by
// calculate-distributional-baselines.mjs, which is where its derivation and its
// measurements live. Each key is declared where its value is produced.
//
// All four keys are ONE vocabulary shared end to end: they are the API payload
// keys `get-players.mjs` emits, the suffixes on the period tables' columns, and
// the period halves of the data-view field ids. The bare period name is the
// positive variant and `_net` is the signed one. That is not tidiness -- the SPA
// recomputes these client-side after any roster mutation, so a second spelling
// on either side blanks the roster surfaces on the first mutation.
export const season_net_aggregate_key = 'season_net'
export const rest_of_season_aggregate_key = 'rest_of_season'
export const rest_of_season_net_aggregate_key = 'rest_of_season_net'

// EVERY PERIOD NET IS A SUM OF WEEKLY-GRAIN NETS, never a draw at period grain.
// Operator ruling 2026-08-05, and it is a rule about the quantity rather than
// about the column: `E[X - b] = E[X] - E[b]` by linearity, so a net drawn at
// season grain is just the projection shifted by one per-position constant and
// cannot see the weekly variance the variant exists to penalise. The two are not
// proxies for one another -- measured on `genesis_10_team` 2026 over 557 players
// covering all 18 weeks, the season-grain drawn net and the weekly-grain summed
// net rank at rho 0.745 overall (TE 0.416).
//
// Nothing in the schema can tell the two apart: both are plausible numbers in a
// plausible column. `test/libs-shared.calculate-player-period-values.spec.mjs`
// is what distinguishes them, by requiring the season net to MOVE when a single
// week's value moves -- which a period-grain draw would not do.
//
// Known and accepted at ruling time: the weekly board being summed carries the
// documented QB-understatement bias, so the summed net is correct in GRAIN and
// biased in LEVEL. A distributional weekly board de-biases it later without
// changing this definition, which is why it is a follow-on rather than a
// prerequisite.
const sum_weekly_points_added = ({ pts_added, from_week }) => {
  let positive = 0
  let net = 0

  for (const [week, value] of Object.entries(pts_added)) {
    const wk = Number(week)
    // `!wk` drops both the season week key (0) and every named aggregate key,
    // which are NaN. Summing an aggregate back into an aggregate is the shape
    // this guard exists to prevent.
    if (!wk || wk < from_week) continue

    // The "did not play / never initialized" sentinel from
    // libs-shared/constants. It must be skipped BEFORE the net accumulator sees
    // it, or one absent week drives the whole period net to -999.
    if (value === default_points_added) continue

    net += value
    if (value > 0) {
      positive += value
    }
  }

  return { positive, net }
}

/**
 * Compute and price both non-week projection periods from the weekly board.
 *
 * Call this AFTER the weekly loop has run `calculate_projection_values` for
 * every week, because it reads the weekly values those calls wrote.
 *
 * Pricing happens here rather than at the call sites for the reason
 * calculate-prices.mjs records: three producers each hand-accumulated a
 * denominator inside a `value > 0` branch and all three forgot the signed
 * variant they were already persisting beside it. An aggregate this module
 * writes leaves it priced, and the denominator for each is derived inside
 * calculate-prices.mjs from the aggregate key.
 *
 * @param {object} params
 * @param {Array<object>} params.players - rows carrying `pts_added`
 * @param {object} params.league - league or league format, for pricing
 * @param {number} [params.current_week] - first week the rest-of-season period
 *   covers; defaults to the live week. Floored at 1, since week 0 is the season
 *   board rather than a week.
 * @returns {Array<object>} the same player rows
 */
const calculate_player_period_values = ({
  players,
  league,
  current_week = current_season.week
}) => {
  const rest_of_season_from_week = Math.max(current_week, 1)

  for (const player of players) {
    if (!player.pts_added) {
      player.pts_added = {}
    }

    const season = sum_weekly_points_added({
      pts_added: player.pts_added,
      from_week: 1
    })
    const rest_of_season = sum_weekly_points_added({
      pts_added: player.pts_added,
      from_week: rest_of_season_from_week
    })

    player.pts_added[season_net_aggregate_key] = season.net
    player.pts_added[rest_of_season_aggregate_key] = rest_of_season.positive
    player.pts_added[rest_of_season_net_aggregate_key] = rest_of_season.net
  }

  // Each aggregate is priced against the sum of its OWN positive parts, derived
  // from the key inside calculatePrices. The positive and net variants of one
  // period are shares of DIFFERENT pools rather than a signed pair, which is
  // what the `positive` / `net` token on each market_salary column names.
  for (const aggregate_key of [
    season_net_aggregate_key,
    rest_of_season_aggregate_key,
    rest_of_season_net_aggregate_key
  ]) {
    calculatePrices({ league_format: league, players, aggregate_key })
  }

  return players
}

export default calculate_player_period_values
