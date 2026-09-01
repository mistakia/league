// One market row per (selection, game) -- the MULTIPLICITY axis of the
// betting-market key.
//
// THE CLASS THIS EXISTS TO CLOSE. A betting fact is keyed by (game, side); a
// data-view cell is keyed by (subject, year, week). Where a book publishes the
// same side of the same game more than once, the market CTE holds several rows
// for one cell and the LEFT JOIN multiplies it -- one player-week renders as
// two rows carrying different lines, with nothing in the output saying which is
// the line.
//
// This is not hypothetical on either path. The player path measured 49
// (pid, nfl_week_id, market_type) groups since 2023 carrying two FanDuel CLOSE
// OVER selections. The team path measured worse: for DRAFTKINGS / CLOSE /
// GAME_SPREAD, 194 of 544 team-weeks in 2025 carry more than one market row for
// the same (team, year, week), 188 of them at conflicting lines.
//
// WHY THE KEY IS (selection, GAME) rather than (selection, year, week). The
// game is what the market is actually attached to, and it fixes the year and
// the week as a consequence. Keying on (year, week) instead is strictly coarser
// -- it would collapse two markets on two different games into one row -- and
// coarser is the direction that renders wrong data, the same asymmetry
// week-scoped-cte.mjs records for the table alias.
//
// One key serves both market shapes. A side-bearing market (GAME_SPREAD, a
// player prop) carries a selection, so the two sides of a game stay two rows. A
// game-level market (GAME_TOTAL) carries no selection at all, and DISTINCT ON
// treats those NULLs as equal, so it collapses to one row per game -- which is
// correct, because a game total is one value for the game.
//
// WHY DISTINCT ON rather than a grouped self-join. The self-join shape is what
// cost player_dfs_salary a 212x plan regression: the planner treats its
// perfectly-correlated keys as independent and collapses the row estimate to 1.
//
// The winner is the newest observation, then the lowest source_market_id, then
// the lowest line. Which of two published lines is CORRECT is not a question a
// data-view column can answer -- that belongs to the odds importer or a market
// dedup policy. This helper only guarantees that a cell renders one of them
// rather than both, and that the one it renders does not move between replans.
//
// THE LINE TIEBREAKER IS NOT DECORATION, AND THE LADDER CASE IS A KNOWN
// LIMITATION. On a SINGLE-LINE market the first two tiebreakers already settle
// it: measured over DRAFTKINGS CLOSE OVER GAME_TOTAL in 2025, 95 of 285
// player-game groups hold more than one row and NONE of them ties on both, so
// the newest observation is a real winner.
//
// An ALT market is a different population that this same key silently swallows.
// An alt ladder is N legitimate rungs published as N selections under ONE
// source_market_id at ONE observed_at, so both of those tiebreakers tie on every
// row: GAME_ALT_TOTAL over the same slice averages 28.95 rows per group against
// a maximum of 50, and 240 of 285 groups tie on both. Without the line in the
// ORDER BY the surviving rung is whatever the plan happened to emit, and it
// moves; with it, the lowest rung wins every time.
//
// Stable is not the same as correct. Collapsing a ladder to one rung is still
// the wrong shape for an alt column -- a cell holds one value and a ladder is
// many -- and no ordering fixes that. The fix is a row axis on the line, so the
// rungs get somewhere to go; this helper only stops the choice from drifting
// until that lands. Do not "fix" the alt column by removing the dedup: that
// restores the duplicate-market fanout on every single-line market.

/**
 * Reduce a market CTE to one row per (selection, game).
 *
 * Call on the builder for the CTE that joins prop_market_selections_index to
 * the markets CTE. Both the player and team paths alias those `pms` and `m`
 * respectively, so the defaults fit every current call site.
 *
 * @param {object} args
 * @param {object} args.qb - knex query builder for the selections CTE
 * @param {string} [args.selection_column] - the side, NULL for a game-level market
 * @param {string} [args.game_column]
 * @param {string} [args.observed_at_column] - newest wins
 * @param {string} [args.source_market_id_column] - first tiebreak
 * @param {string} [args.selection_metric_line_column] - last tiebreak; the only
 *   one an alt ladder does not tie on
 */
export const apply_market_row_dedup = ({
  qb,
  selection_column = 'pms.selection_pid',
  game_column = 'm.esbid',
  observed_at_column = 'pms.observed_at',
  source_market_id_column = 'm.source_market_id',
  selection_metric_line_column = 'pms.selection_metric_line'
}) => {
  // Postgres requires the DISTINCT ON expressions to be the leading ORDER BY
  // expressions, so the two lists are written together and cannot drift.
  qb.distinctOn(selection_column, game_column).orderBy([
    { column: selection_column },
    { column: game_column },
    { column: observed_at_column, order: 'desc' },
    { column: source_market_id_column },
    { column: selection_metric_line_column }
  ])
}
