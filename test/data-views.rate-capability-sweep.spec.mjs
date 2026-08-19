/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'
import player_stats from '#libs-server/data-views-column-definitions/player-stats-from-plays-column-definitions.mjs'
import team_stats from '#libs-server/data-views-column-definitions/team-stats-from-plays-column-definitions.mjs'

const expect = chai.expect

const per_game = { period: 'game', aggregation: 'rate', threshold: null }

// The eight share columns used to be EXEMPT here, identified by the absence of
// a `supports_periods` property, because `create_team_share_stat` was a second
// factory that declared neither it nor `supports_output`. That factory is gone:
// a share is now an ordinary column over the `plays_cohort` fact source, and it
// lands in the carve-out group on its own terms -- a combined measure has no
// single measure_expr for an aggregator plugin to consume, so it advertises no
// aggregation. The exemption is deleted rather than repointed, which puts the
// eight under the same assertions as everything else.

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
    const shares = all.filter(([id]) => id.includes('_share_from_plays'))
    expect(shares.length, shares.join(', ')).to.equal(7)
    for (const [column_id, def] of shares) {
      expect(Boolean(def.supports_output), column_id).to.equal(false)
    }
  })

  describe('rate-capable columns emit a divisor for per_game', () => {
    for (const [column_id, def] of rate_capable) {
      it(`${column_id}`, async () => {
        // closed measure-kind aggregate set
        expect(['sum', 'count_distinct'], column_id).to.include(def.aggregate)
        expect(def.supports_periods.length, column_id).to.be.greaterThan(0)
        const is_team =
          column_id.startsWith('team_') && !column_id.startsWith('player_team_')
        const sql = await build_per_game_sql(column_id, is_team)
        expect(sql, `${column_id} missing divisor`).to.match(
          /rate_type_total_count/
        )
      })
    }
  })

  describe('carve-out columns advertise no rate types', () => {
    for (const [column_id, def] of carve_outs) {
      it(`${column_id}`, () => {
        expect(def.supports_periods, column_id).to.deep.equal([])
        expect(def.supports_output, column_id).to.be.not.ok
      })
    }
  })

  it('time_to_throw is a carve-out (no rate types)', () => {
    const def = player_stats.player_time_to_throw_from_plays
    expect(def.supports_periods).to.deep.equal([])
    expect(def.supports_output).to.be.not.ok
  })
})
