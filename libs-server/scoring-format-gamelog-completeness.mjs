import db from '#db'
import { fantasy_positions } from '#constants'

// Row presence in `scoring_format_player_gamelogs` is format-INDEPENDENT by
// construction. `scripts/generate-scoring-format-player-gamelogs.mjs` takes its
// row set from `player_gamelogs` joined to `player` on a fantasy primary
// position, and nothing on the insert path consults the scoring format -- the
// format decides the `points` VALUE, never which (pid, esbid) pairs exist. So
// every scoring format must hold exactly the same set of rows for a season, and
// that set is computable without reference to any format.
//
// Measured as |expected n stored| / |expected u stored| rather than
// stored/expected, because the two real defects point in OPPOSITE directions
// and a one-sided ratio can only see one of them:
//
//   MISSING rows  -- a format never regenerated after a `player_gamelogs`
//                    backfill added rows (2025 genesis: 8,775 against 11,413).
//   EXTRA rows    -- a format never regenerated after a player's
//                    primary_position left `fantasy_positions`, so rows that no
//                    longer qualify are still stored (2025: 391 such rows on
//                    every format except the repaired one).
//
// Intersection-over-union makes 1.0 mean the sets are IDENTICAL, so both a
// dropped row and a stale one fall below the floor. A stored/expected ratio
// scores the extra-row case at 1.03 and passes it.

/**
 * Per-season, per-format completeness of scoring_format_player_gamelogs.
 *
 * @returns {Promise<Array<object>>} rows carrying the grain plus numerator and denominator
 */
export const scoring_format_gamelog_completeness_rows = async () => {
  const season_rows = await db('player_gamelogs')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.season_type', 'REG')
    .distinct('nfl_games.season_year')
    .orderBy('nfl_games.season_year')

  const season_years = season_rows.map((row) => Number(row.season_year))

  // The format axis comes from the CATALOG, never from the stored rows.
  // Grouping the stored table by scoring_format_id cannot emit a row for a
  // format holding nothing, so a format that was never generated at all would
  // be graded zero times and pass in silence -- which is the state sfb16_mfl
  // and sfb16_sleeper were in when this check was written.
  const catalog_rows = await db('league_scoring_formats').select('id')
  const catalog_ids = catalog_rows.map((row) => row.id)

  const rows = []

  for (const season_year of season_years) {
    const expected_subquery = db('player_gamelogs')
      .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
      .join('player', 'player.pid', 'player_gamelogs.pid')
      .where('nfl_games.season_type', 'REG')
      .where('nfl_games.season_year', season_year)
      .whereIn('player.primary_position', fantasy_positions)
      .select('player_gamelogs.pid', 'player_gamelogs.esbid')

    const [{ expected_n }] = await db
      .from(expected_subquery.as('expected'))
      .count('* as expected_n')

    const expected_count = Number(expected_n)

    const stored = await db({ g: 'scoring_format_player_gamelogs' })
      .join('nfl_games', 'nfl_games.esbid', 'g.esbid')
      .leftJoin(expected_subquery.as('e'), function () {
        this.on('e.pid', 'g.pid').andOn('e.esbid', 'g.esbid')
      })
      .where('nfl_games.season_type', 'REG')
      .where('nfl_games.season_year', season_year)
      .groupBy('g.scoring_format_id')
      .select('g.scoring_format_id')
      .count('* as stored_n')
      .count('e.pid as matched_n')

    const by_format = new Map(
      stored.map((row) => [
        row.scoring_format_id,
        { stored_n: Number(row.stored_n), matched_n: Number(row.matched_n) }
      ])
    )

    for (const scoring_format_id of catalog_ids) {
      const { stored_n, matched_n } = by_format.get(scoring_format_id) || {
        stored_n: 0,
        matched_n: 0
      }
      rows.push({
        season_year,
        scoring_format_id,
        numerator: matched_n,
        denominator: expected_count + stored_n - matched_n,
        expected_n: expected_count,
        stored_n
      })
    }
  }

  return rows
}
