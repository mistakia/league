/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'
import player_stats from '#libs-server/data-views-column-definitions/player-stats-from-plays-column-definitions.mjs'
import team_stats from '#libs-server/data-views-column-definitions/team-stats-from-plays-column-definitions.mjs'

const expect = chai.expect

const per_game = { period: 'game', aggregation: 'rate', threshold: null }

// The eight share columns used to be EXEMPT here, identified by the absence of
// a `supports_periods` property, because `create_team_share_stat` was a second
// factory that declared neither it nor `supports_output`. That factory is gone
// and the exemption with it: a share is an ordinary column over the
// `plays_cohort` fact source, aggregable exactly as any other measure.
//
// `supports_periods` is NOT the period list any more -- it is the column's
// extra DENOMINATOR UNITS, which a ratio column may legitimately leave empty
// while still offering `game`. The advertised periods live on
// `supports_output.periods`, so that is what the assertions read.

const build_per_game_sql = async (column_id, is_team) => {
  const request = {
    columns: [{ column_id, params: { year: [2023], output: per_game } }]
  }
  if (is_team) request.row_grain = ['team']
  const { query } = await get_data_view_results_query(request)
  return query.toString()
}

describe('data-views rate-capability sweep', () => {
  const all = Object.entries({ ...player_stats, ...team_stats })

  // Every column is now in exactly one of the two groups below. Asserting the
  // partition covers the whole registry keeps a definition that stops matching
  // either predicate from silently leaving the sweep.
  const rate_capable = all.filter(([, def]) => def.supports_output)
  const carve_outs = all.filter(([, def]) => !def.supports_output)

  it('partitions the whole from-plays registry', () => {
    expect(rate_capable.length + carve_outs.length).to.equal(all.length)
    expect(all.length).to.be.greaterThan(80)
    // The shares are rate-capable on the same terms as everything else. This
    // asserted the opposite while a combined measure advertised nothing.
    const shares = all.filter(([id]) => id.includes('_share_from_plays'))
    expect(shares.length, shares.join(', ')).to.equal(7)
    for (const [column_id, def] of shares) {
      expect(Boolean(def.supports_output), column_id).to.equal(true)
    }
  })

  describe('rate-capable columns emit a divisor for per_game', () => {
    for (const [column_id, def] of rate_capable) {
      it(`${column_id}`, async () => {
        // A measure is either one accumulator from the closed aggregate set, or
        // several plus a combine. Exactly one of the two, never neither.
        if (def.combined_measure) {
          expect(def.aggregate, column_id).to.equal(undefined)
        } else {
          expect(['sum', 'count_distinct'], column_id).to.include(def.aggregate)
        }
        expect(def.supports_output.periods.length, column_id).to.be.greaterThan(
          0
        )
        const is_team =
          column_id.startsWith('team_') && !column_id.startsWith('player_team_')
        const sql = await build_per_game_sql(column_id, is_team)
        expect(sql, `${column_id} missing divisor`).to.match(
          /rate_type_total_count/
        )
      })
    }
  })

  // Two ways to be a carve-out, and they are different claims. A column with no
  // MEASURE has nothing to aggregate and declares no denominator periods. A
  // `player_team_` column has a perfectly good measure and is withheld because
  // the aggregator cannot serve its subject grain, so it keeps its periods --
  // asserting `[]` on it would be asserting the wrong reason.
  describe('carve-out columns advertise no rate types', () => {
    for (const [column_id, def] of carve_outs) {
      it(`${column_id}`, () => {
        expect(def.supports_output, column_id).to.be.not.ok
        if (!column_id.startsWith('player_team_')) {
          expect(def.supports_periods, column_id).to.deep.equal([])
        }
      })
    }
  })

  // The slice's deliverable, asserted over the whole population rather than on
  // one column: every combined measure reaches the per-period family. It is a
  // property of the period CTE projecting the combine, so a regression there
  // takes all 42 down together and this is the one place that would say so.
  it('every combined measure offers count and mean over the partitions', () => {
    // Excluding the withheld `player_team_` variant, which carries a combined
    // measure the aggregator cannot serve -- see the assertion below it.
    const combined = all.filter(
      ([id, def]) => def.combined_measure && !id.startsWith('player_team_')
    )
    expect(combined.length, 'combined measures').to.be.greaterThan(40)
    for (const [column_id, def] of combined) {
      expect(def.supports_output.aggregations, column_id).to.include('count')
      expect(def.supports_output.aggregations, column_id).to.include('mean')
      expect(def.supports_output.periods, column_id).to.include('game')
      expect(def.supports_output.periods, column_id).to.include('season')
    }
  })

  // A `player_team_*` column is a TEAM statistic pooled over the games one
  // PLAYER was active for, which only the `_player_team_stats` CTE knows how to
  // build. The output aggregator groups the fact scan by the column's own
  // subject id instead, and a `plays` source names no player, so every
  // aggregation request on one answered `column nfl_plays.pid does not exist`.
  // Measured at 95a949c6e on the ADDITIVE variants, so it is older than the
  // ratio conversion. Withholding the capability is what keeps a request from
  // reaching that path at all.
  it('no player_team_ column advertises an aggregation it cannot serve', () => {
    const player_team = Object.entries(team_stats).filter(([id]) =>
      id.startsWith('player_team_')
    )
    expect(player_team.length, 'player_team_ columns').to.be.greaterThan(20)
    for (const [column_id, def] of player_team) {
      expect(def.supports_output, column_id).to.be.not.ok
    }
  })

  // Time-to-throw was a carve-out only while it lived in a raw
  // `with_select_string`. It is a two-accumulator mean over qualifying
  // dropbacks, so it aggregates like any other ratio.
  it('time_to_throw is an ordinary two-accumulator measure', () => {
    const def = player_stats.player_time_to_throw_from_plays
    expect(def.supports_periods).to.deep.equal([])
    expect(Boolean(def.combined_measure)).to.equal(true)
    expect(def.supports_output.aggregations).to.include('mean')
  })
})
