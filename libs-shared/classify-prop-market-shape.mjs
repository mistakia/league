import {
  ladder_market_types,
  yes_no_market_types
} from '#libs-shared/bookmaker-constants.mjs'

/**
 * The shape a prop market takes, which decides how a consumer renders and
 * grades it.
 *
 * This exists because three separate ad-hoc tests were answering the question
 * differently in one component: a `market_name.includes('ALT')` substring
 * match, a "any selection has a non-null line" heuristic, and a
 * `selection_name.toLowerCase().includes('over')` parse of a display string.
 * Each was wrong for a measurable population -- every `yes_no_market_types`
 * member carries a line, so the heuristic routed anytime-touchdown markets
 * onto a chart built for over/under, and the display-string parse put every
 * bookmaker's YES selection on the under series.
 *
 * The values name the distinguishing property rather than enumerating members,
 * per user:guideline/write/write-software.md. `over_under` was rejected on
 * that rule -- it names the two sides instead of the property -- and it is
 * already taken elsewhere for a game total.
 *
 * @typedef {'untyped'|'occurrence'|'ladder'|'single_line'|'no_line'} PropMarketShape
 */

/**
 * Classify a prop market by the shape it renders and grades as.
 *
 * The sets are the canonical ones in `bookmaker-constants.mjs`, deliberately
 * not restated here: `ladder_market_types` carries its own comment explaining
 * that it exists so the server and the client answer the ladder question
 * identically, and it is actively widened by the market-type taxonomy work.
 * Reading it means this function moves with it.
 *
 * `selection_metric_line` is what separates the two untyped-by-neither-set
 * cases. A market that is typed and in neither set still splits: a receiving
 * yards prop carries a line, while a moneyline or race-to-points market does
 * not, and they cannot share a rendering.
 *
 * @param {object} params
 * @param {string|null|undefined} params.market_type
 * @param {number|string|null|undefined} params.selection_metric_line
 * @returns {PropMarketShape}
 */
export const classify_prop_market_shape = ({
  market_type,
  selection_metric_line
}) => {
  // Absence of a type is a real and common state, not a defect to repair: it
  // is 38.4 percent of 2025 player markets, and settlement cannot reach any of
  // them. A consumer must be able to say so rather than guess a shape.
  if (!market_type) return 'untyped'

  if (yes_no_market_types.has(market_type)) return 'occurrence'
  if (ladder_market_types.has(market_type)) return 'ladder'

  return selection_metric_line === null || selection_metric_line === undefined
    ? 'no_line'
    : 'single_line'
}

export default classify_prop_market_shape
