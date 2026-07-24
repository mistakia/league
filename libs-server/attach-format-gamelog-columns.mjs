/**
 * Attach a league's fantasy-points columns to a `player_gamelogs` query.
 *
 * The format id MUST live in the join's ON clause, never in a WHERE filter.
 * Filtering on `scoring_format_id` / `league_format_id` in WHERE turns these
 * LEFT JOINs into INNER JOINs for any gamelog that has rows under some other
 * format but not the requested one -- an `orWhereNull` escape does not save it,
 * because the join has already produced non-null rows for those other formats.
 * The whole gamelog then disappears from the response instead of coming back
 * with null points.
 *
 * That defect silently blanked every 2025 regular-season gamelog for callers
 * resolving to the default league, because the named catalog formats had no
 * 2025 derived rows. Keeping the predicate in the ON clause makes a missing
 * format degrade to null points rather than a vanished row.
 *
 * @param {Object} params
 * @param {Object} params.query - Knex query builder rooted at `player_gamelogs`
 * @param {Object} params.league - League with scoring_format_id / league_format_id
 * @returns {Object} The same query builder, for chaining
 */
export default function attach_format_gamelog_columns({ query, league }) {
  return query
    .leftJoin('scoring_format_player_gamelogs', function () {
      this.on('scoring_format_player_gamelogs.pid', '=', 'player_gamelogs.pid')
        .andOn(
          'scoring_format_player_gamelogs.esbid',
          '=',
          'player_gamelogs.esbid'
        )
        .andOnVal(
          'scoring_format_player_gamelogs.scoring_format_id',
          '=',
          league.scoring_format_id
        )
    })
    .leftJoin('league_format_player_gamelogs', function () {
      this.on('league_format_player_gamelogs.pid', '=', 'player_gamelogs.pid')
        .andOn(
          'league_format_player_gamelogs.esbid',
          '=',
          'player_gamelogs.esbid'
        )
        .andOnVal(
          'league_format_player_gamelogs.league_format_id',
          '=',
          league.league_format_id
        )
    })
    .select(
      'scoring_format_player_gamelogs.points',
      'scoring_format_player_gamelogs.pos_rnk',
      'league_format_player_gamelogs.points_added_earned',
      'league_format_player_gamelogs.points_added_net'
    )
}
