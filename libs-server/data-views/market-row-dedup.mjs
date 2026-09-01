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
// The winner is the newest observation, ties broken on source_market_id so the
// choice is deterministic rather than plan-dependent. Which of two published
// lines is CORRECT is not a question a data-view column can answer -- that
// belongs to the odds importer or a market dedup policy. This helper only
// guarantees that a cell renders one of them rather than both.

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
 * @param {string} [args.source_market_id_column] - deterministic tiebreak
 */
export const apply_market_row_dedup = ({
  qb,
  selection_column = 'pms.selection_pid',
  game_column = 'm.esbid',
  observed_at_column = 'pms.observed_at',
  source_market_id_column = 'm.source_market_id'
}) => {
  // Postgres requires the DISTINCT ON expressions to be the leading ORDER BY
  // expressions, so the two lists are written together and cannot drift.
  qb.distinctOn(selection_column, game_column).orderBy([
    { column: selection_column },
    { column: game_column },
    { column: observed_at_column, order: 'desc' },
    { column: source_market_id_column }
  ])
}
