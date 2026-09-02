// Restrict a market query to PREGAME rows -- the IN-PLAY axis of the
// betting-market key, and the sibling of market-row-dedup.mjs.
//
// THE CLASS THIS EXISTS TO CLOSE. A betting-market column names a pregame
// concept: the line the book published before the game started. An in-play line
// is a different fact -- the same statistic repriced mid-game, against a score
// and a clock the pregame line could not know. Nothing separated them, so a
// live row landed in the same population as a pregame one and the two competed
// for one cell. Measured on the dedup key, 1,658 cells hold both and the live
// row wins the newest-observation ordering in 1,102 of them.
//
// THE NULL IS THE WHOLE PROBLEM, and it is why this is a helper rather than a
// clause written three times. `is_live` is populated by exactly two importers.
// The other four books leave it NULL:
//
//   FANDUEL     20,509 live      0 null
//   PINNACLE        94 live      0 null
//   CAESARS          0 live    450,431 null
//   DRAFTKINGS       0 live    788,792 null
//   BETRIVERS        0 live    103,184 null
//   BETMGM           0 live     17,450 null
//
// A NULL means "this importer does not report the distinction", not "this is a
// live market". So the filter has to READ AS not-live, and the obvious spelling
// does the opposite: `whereNot('is_live', true)` compiles to `NOT (is_live =
// true)`, which evaluates to NULL on a NULL row, which WHERE discards. That one
// would blank 1,359,857 rows across four books -- five hundred times the
// population it is meant to remove -- and every one of them is a market that
// was never live.
//
// This is the negative-pattern trap in `docs/guides/gates.md`: a predicate that
// cannot match returns a confident zero, and here it returns a confident empty
// column. The spec pins the NULL case specifically, and it fails on the
// `whereNot` spelling.
//
// WHY A FILTER RATHER THAN A DEDUP TIEBREAK. Preferring a pregame row in
// market-row-dedup.mjs's ORDER BY would fix the 1,102 contested cells without
// blanking anything, and it was proposed. It cannot be the whole answer,
// because the dedup is SUPPRESSED under an active line row axis: there every
// selection becomes its own visible row, so a live row does not outrank a
// pregame one, it renders ALONGSIDE it as a second row. An ordering fix cannot
// reach a path that does no ordering. The filter reaches both, which is why the
// identity bridge carries it too.
//
// WHAT THIS BLANKS, DELIBERATELY. 1,903 cells hold a live row and no pregame
// row, so they render nothing after this. They are not a live-only market
// class: 1,866 of the 1,903 are FANDUEL 2023, on ordinary player prop types --
// receiving yards, anytime touchdown, receptions -- where a pregame line
// certainly existed and simply was not captured that season. Showing the
// in-play line in those cells presents a mid-game price as the pregame one,
// which is the misrepresentation this closes rather than data it discards.
// 2024 and 2026 hold zero; 2025 holds 37.
//
// SETTLEMENT IS DELIBERATELY NOT A CALLER. A live line prices the same
// full-game cumulative statistic, not a rest-of-game residual -- live lines
// move ABOVE their pregame counterparts, which a residual proposition cannot do
// -- so grading a live market against the full-game result is correct. Adding
// this to fetch_markets_for_games would stop grading 20,509 markets that grade
// right. The contamination is a READ problem, not a settlement one.

/**
 * Restrict a market query to rows that are not in-play.
 *
 * A NULL `is_live` counts as pregame: it means the importer does not report the
 * distinction, and four of the six books never do.
 *
 * @param {object} args
 * @param {object} args.qb - knex query builder
 * @param {string} [args.column] - qualified `is_live` column for this query
 */
export const apply_pregame_market_filter = ({
  qb,
  column = 'prop_markets_index.is_live'
}) => {
  qb.where(function () {
    this.where(column, false).orWhereNull(column)
  })
}
