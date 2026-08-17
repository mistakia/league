/* global describe it */

import knex from 'knex'
import * as chai from 'chai'

import attach_format_gamelog_columns from '#libs-server/attach-format-gamelog-columns.mjs'

// Regression: the format id used to be applied as a WHERE filter paired with
// an `orWhereNull` escape instead of living in the join's ON clause. That turns
// both LEFT JOINs into INNER JOINs for any gamelog carrying rows under some
// other format -- the join emits non-null rows for those other formats, so the
// null escape never fires and the WHERE discards every row. Whole seasons
// vanished from /players/:pid/gamelogs and /stats/gamelogs/players rather than
// coming back with null points. Locking the SQL shape here because the failure
// is invisible at the API contract level: the response is a well-formed, and
// simply shorter, array.

const { expect } = chai

const build_gamelogs_sql = ({ scoring_format_id, league_format_id }) => {
  const db = knex({ client: 'pg' })
  const query = db('player_gamelogs').where('player_gamelogs.pid', 'TEST-PID')
  attach_format_gamelog_columns({
    query,
    league: { scoring_format_id, league_format_id }
  })
  return query.toString()
}

describe('attach_format_gamelog_columns', () => {
  const sql = build_gamelogs_sql({
    scoring_format_id: 'draftkings',
    league_format_id: 'genesis_10_team'
  })

  it('keeps both joins as LEFT JOINs', () => {
    expect(sql).to.include('left join "scoring_format_player_gamelogs"')
    expect(sql).to.include('left join "league_format_player_gamelogs"')
    expect(sql).to.not.include('inner join "scoring_format_player_gamelogs"')
    expect(sql).to.not.include('inner join "league_format_player_gamelogs"')
  })

  it('constrains the scoring format id inside the ON clause', () => {
    const on_clause = sql.slice(
      sql.indexOf('left join "scoring_format_player_gamelogs"'),
      sql.indexOf('left join "league_format_player_gamelogs"')
    )
    expect(on_clause).to.include(
      '"scoring_format_player_gamelogs"."scoring_format_id" = \'draftkings\''
    )
  })

  it('constrains the league format id inside the ON clause', () => {
    const on_clause = sql.slice(
      sql.indexOf('left join "league_format_player_gamelogs"'),
      sql.indexOf(' where ')
    )
    expect(on_clause).to.include(
      '"league_format_player_gamelogs"."league_format_id" = \'genesis_10_team\''
    )
  })

  it('never filters either format id in the WHERE clause', () => {
    const where_clause = sql.slice(sql.indexOf(' where '))
    expect(where_clause).to.not.include('scoring_format_id')
    expect(where_clause).to.not.include('league_format_id')
  })

  it('does not reintroduce the orWhereNull escape hatch', () => {
    expect(sql).to.not.include('is null')
  })

  it('selects the fantasy point columns from both format tables', () => {
    expect(sql).to.include('"scoring_format_player_gamelogs"."points"')
    expect(sql).to.include('"scoring_format_player_gamelogs"."position_rank"')
    expect(sql).to.include(
      '"league_format_player_gamelogs"."points_added_earned"'
    )
    expect(sql).to.include('"league_format_player_gamelogs"."points_added_net"')
  })
})
