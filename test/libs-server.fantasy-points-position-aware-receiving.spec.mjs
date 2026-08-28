/* global describe it */

import * as chai from 'chai'

import db from '#db'
import { build_period_cte } from '#libs-server/data-views/output-aggregator/build-period-cte.mjs'
import column_defs from '#libs-server/data-views-column-definitions/player-fantasy-points-from-plays-column-definitions.mjs'
import { needs_position_data } from '#libs-server/data-views/fantasy-points-scoring-expressions.mjs'

const expect = chai.expect

// Position-aware receiving on the ROLE-UNION path.
//
// The from-plays column has two builders. The legacy `with` builder has always
// scored the positional reception premium (running_back_reception /
// wide_receiver_reception / tight_end_reception) by projecting the target's
// position into its filtered_plays CTE. The role-union builder did not, and a
// comment claimed it could not -- that it needed a leftJoin on `player` the
// builder did not support. `apply_joins` had in fact been added to that path for
// the nfl_play_stats-sourced roles and applies to any role supplying one, so the
// capability was there and unused.
//
// The cost of the gap was not theoretical. Measured against production for
// a TE-premium format over 2024 REG, 113 of 117 tight ends disagreed between the two
// builders -- Austin Hooper at 194.6 on the role-union path against 239.6 on the
// `with` path, a 45-point season gap on a format whose whole identity is the TE
// premium. Five production formats carry a positional value.
//
// These assertions pin the SQL SHAPE rather than executed points, because the
// suite's seeded database has no real season: a residual here would measure the
// fixtures. The population-level equality is what the production check
// established; what a spec can own is that the join and the CASE are emitted for
// a positional format and absent for a uniform one.

const column_def = column_defs.player_fantasy_points_from_plays

const query_context = { row_axes: ['year'], nfl_week_ids: [] }

const build_role_union_sql = async (scoring_format_id) => {
  const params = { year: [2024], seas_type: ['REG'], scoring_format_id }
  const role_attributions = await column_def.role_attributions({
    params,
    identity_id: 'player'
  })
  return build_period_cte({
    measure_source: 'plays_role_union',
    measure_expr: null,
    role_attributions,
    period: 'season',
    query_context,
    identity_id: 'player',
    params
  }).toString()
}

describe('from-plays position-aware receiving', () => {
  it('gates both builders on one predicate derived from the role table', async () => {
    const sfb = await db('league_scoring_formats')
      .where('id', 'te_premium')
      .first()

    // The te_premium fixture pays 1.0 per reception and 2.0 to a tight end.
    expect(Number(sfb.tight_end_reception)).to.not.equal(Number(sfb.receptions))
    expect(needs_position_data(sfb)).to.equal(true)

    // A format with no positional value must not pay for the join.
    expect(
      needs_position_data({
        receptions: 1,
        running_back_reception: 1,
        wide_receiver_reception: 1,
        tight_end_reception: 1
      })
    ).to.equal(false)
    expect(needs_position_data(null)).to.equal(false)
  })

  it('joins player and emits the positional CASE for a positional format', async () => {
    const sql = await build_role_union_sql('te_premium')

    expect(sql).to.include('left join "player" as "p_trg"')
    expect(sql).to.include('CASE p_trg.primary_position')
    // The TE premium itself, not merely the presence of a CASE -- a CASE
    // carrying the base value everywhere would score identically to no CASE.
    expect(sql).to.match(/WHEN 'TE' THEN 2/)

    // The join must restrict to the positions the `with` builder restricts to.
    // A player outside the set reads NULL and falls through to the base value,
    // so widening it here would change scoring on one path only.
    expect(sql).to.include("'RB', 'WR', 'TE', 'FB'")
  })

  it('emits neither the join nor the CASE for a uniform-reception format', async () => {
    // `draftkings` scores every reception at 1.0 regardless of position. Its
    // SQL must be unchanged by this feature -- which is what keeps the
    // data-view goldens byte-identical.
    //
    // The format id has to be one the seeded database actually carries:
    // get_scoring_format falls back to default scoring for an unknown id under
    // NODE_ENV=test, which passes these assertions without ever exercising a
    // real format row.
    const uniform = await db('league_scoring_formats')
      .where('id', 'draftkings')
      .first()
    expect(uniform, 'draftkings format seeded').to.exist
    expect(Number(uniform.tight_end_reception)).to.equal(
      Number(uniform.receptions)
    )

    const sql = await build_role_union_sql('draftkings')

    expect(sql).to.not.include('p_trg')
    expect(sql).to.not.include('primary_position')
  })
})
