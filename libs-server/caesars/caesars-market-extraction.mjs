// SHAPE RULES FOR THE CAESARS v4 PAYLOAD, IN CORE SO CI CAN RUN THEM.
//
// Same reason caesars-market-types.mjs lives here: `private/` is a submodule no
// workflow checks out, so a spec importing it aborts the whole suite during
// module load and reports ZERO tests -- which reads as success. Both functions
// below are pure and decide what the importer ingests, so a spec that only ran
// by hand, with its result recorded in a commit message, would be the weakest
// coverage on the highest-consequence rule. The session, fetch and cache half
// stays in private/.

/**
 * Pull the markets out of a v4 payload.
 *
 * `require_event_wrapper` defaults to TRUE, and the default is the point.
 *
 * On the EVENT path the `.event` wrapper is universal -- present in 400 of 400
 * sampled event-tab payloads, with bare top-level `keyMarketGroups` in 0 of 587
 * -- so the two shapes do not coexist there and this throw is that path's only
 * shape check. It is what catches the vendor's silent default-tab fallback,
 * which answers an unknown tab id with plausible markets from the wrong place.
 * Removing it outright would disarm that guard.
 *
 * On the COMPETITION TAB path the events carry `keyMarketGroups` bare, with no
 * wrapper at all (confirmed live 2026-09-04). Only that caller passes false.
 *
 * Defaulting to the strict behaviour means a call site added later without
 * thought inherits the guard rather than silently losing it.
 */
export const extract_markets_from_v4_payload = (
  payload,
  { require_event_wrapper = true } = {}
) => {
  if (!payload) {
    return []
  }

  if (require_event_wrapper && !payload.event) {
    throw new Error('Expected event wrapper in v4 response')
  }

  const event_data = payload.event ?? payload

  if (
    !event_data.keyMarketGroups ||
    !Array.isArray(event_data.keyMarketGroups)
  ) {
    return []
  }

  const markets = []
  for (const group of event_data.keyMarketGroups) {
    if (group.markets && Array.isArray(group.markets)) {
      markets.push(...group.markets)
    }
  }

  return markets
}

// A FUTURE IS AN EVENTLESS MARKET. THAT IS THE WHOLE RULE.
//
// The competition tab tree does NOT separate futures from game markets, and its
// tab names actively mislead: 'Passing', 'Receiving', 'Rushing' and 'TD Scorer'
// read as season-long tabs and are mostly game-grain player props, while still
// holding a handful of genuine season leaders each. So there is no tab allowlist
// that is both correct and stable -- three of those tabs mix grains inside
// themselves.
//
// The grain is a property of the MARKET: a game-grain market carries
// `metadata.sourceEventKey` naming the game it belongs to, and a season-long
// future carries no event key at all. Measured across all 2,928 markets in all
// 16 tabs on 2026-09-04: 2,116 carry the key, 812 do not, and the number of
// markets that lack the key while still being served by a game tab is ZERO. So
// the rule never mistakes a game market for a future.
//
// This matters more than tidiness. Markets admitted here are formatted
// EVENTLESS, with no esbid. Admitting a game-grain market would write it with a
// null esbid -- invisible to settlement, to hit rates and to the data-view
// market CTE, and recoverable only by an adhoc backfill. That is not
// hypothetical: 414,963 Caesars rows were written that way over thirteen months
// and took db/adhoc/2026-09-01-stamp-caesars-esbid-across-the-match-gap.sql to
// repair.
export const is_futures_market = (market) => !market?.metadata?.sourceEventKey
