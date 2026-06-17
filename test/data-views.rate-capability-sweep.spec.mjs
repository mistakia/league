/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'
import player_stats from '#libs-server/data-views-column-definitions/player-stats-from-plays-column-definitions.mjs'
import team_stats from '#libs-server/data-views-column-definitions/team-stats-from-plays-column-definitions.mjs'

const expect = chai.expect

const per_game = { period: 'game', aggregation: 'rate', threshold: null }

// create_team_share_stat columns are a separate factory (no supports_output, no
// supported_rate_types property) -- non-rate by construction. Exempt them
// explicitly so the sweep neither false-positives nor silently skips them.
const is_share_stat = (def) => !('supported_rate_types' in def)

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

  it('exempts exactly the 8 create_team_share_stat columns', () => {
    const shares = all.filter(([, def]) => is_share_stat(def)).map(([id]) => id)
    expect(shares.length, shares.join(', ')).to.equal(8)
  })

  const rate_capable = all.filter(
    ([, def]) => !is_share_stat(def) && def.supports_output
  )
  const carve_outs = all.filter(
    ([, def]) => !is_share_stat(def) && !def.supports_output
  )

  describe('rate-capable columns emit a divisor for per_game', () => {
    for (const [column_id, def] of rate_capable) {
      it(`${column_id}`, async () => {
        // closed measure-kind aggregate set
        expect(['sum', 'count_distinct'], column_id).to.include(def.aggregate)
        expect(def.supported_rate_types.length, column_id).to.be.greaterThan(0)
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
        expect(def.supported_rate_types, column_id).to.deep.equal([])
        expect(def.supports_output, column_id).to.be.not.ok
      })
    }
  })

  it('time_to_throw is a carve-out (no rate types)', () => {
    const def = player_stats.player_time_to_throw_from_plays
    expect(def.supported_rate_types).to.deep.equal([])
    expect(def.supports_output).to.be.not.ok
  })
})
