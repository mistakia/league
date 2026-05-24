/* global describe it before */

import MockDate from 'mockdate'
import debug from 'debug'

import { get_data_view_results_query } from '#libs-server'
import { compare_queries } from './utils/index.mjs'

// Parity audit: legacy `rate_type` params and native `output` params should
// produce byte-identical SQL after request-time normalization. Seeded across
// the 6 column families that declare `supported_rate_types`: stats-from-plays,
// fantasy-points, games-played, routes, snaps, team.

const assert_output_parity = async ({
  column_id,
  params_legacy,
  params_native,
  splits = [],
  where = []
}) => {
  const legacy_request = {
    columns: [{ column_id, params: params_legacy }],
    sort: [],
    where,
    splits
  }
  const native_request = {
    columns: [{ column_id, params: params_native }],
    sort: [],
    where,
    splits
  }

  const { query: legacy_query } =
    await get_data_view_results_query(legacy_request)
  const { query: native_query } =
    await get_data_view_results_query(native_request)

  compare_queries(legacy_query.toString(), native_query.toString())
}

const rate_type_fixtures = [
  {
    family: 'stats-from-plays',
    column_id: 'player_rush_yards_from_plays',
    rate_type: 'per_game',
    output: { period: 'game', aggregation: 'rate', threshold: null },
    params: { year: [2023] }
  },
  {
    family: 'stats-from-plays',
    column_id: 'player_pass_yards_from_plays',
    rate_type: 'per_team_play',
    output: { period: 'team_play', aggregation: 'rate', threshold: null },
    params: { year: [2023] }
  },
  {
    family: 'fantasy-points',
    column_id: 'player_fantasy_points_from_plays',
    rate_type: 'per_game',
    output: { period: 'game', aggregation: 'rate', threshold: null },
    params: { year: [2023] }
  },
  {
    family: 'fantasy-points',
    column_id: 'player_fantasy_points_from_plays',
    rate_type: 'per_player_route',
    output: { period: 'player_route', aggregation: 'rate', threshold: null },
    params: { year: [2023] }
  },
  {
    family: 'routes',
    column_id: 'player_routes',
    rate_type: 'per_team_pass_play',
    output: { period: 'team_pass_play', aggregation: 'rate', threshold: null },
    params: { year: [2023] }
  },
  {
    family: 'snaps',
    column_id: 'player_snaps',
    rate_type: 'per_team_play',
    output: { period: 'team_play', aggregation: 'rate', threshold: null },
    params: { year: [2023] }
  },
  {
    family: 'team',
    column_id: 'team_pass_attempts_from_plays',
    rate_type: 'per_game',
    output: { period: 'game', aggregation: 'rate', threshold: null },
    params: { year: [2023] }
  }
]

describe('Data View output parity', () => {
  before(() => {
    MockDate.reset()
    debug.enable('data-views')
  })

  // The rate_type -> output retrofit (sub-bullet #11) and the Outer SELECT
  // dispatch wiring (sub-bullet #6) must make these fixtures pass. Today the
  // dispatcher at libs-server/get-data-view-results.mjs:1559 still keys off
  // params.rate_type; an output-only request never triggers the rate-type
  // CTE, so the SQL diverges. Skipped until the retrofit lands; the fixtures
  // exist as the red gate the retrofit must turn green.
  describe('legacy rate_type vs native output', () => {
    for (const fixture of rate_type_fixtures) {
      const {
        family,
        column_id,
        rate_type,
        output,
        params,
        splits = [],
        where = []
      } = fixture
      const name = `[${family}] ${column_id} :: rate_type=${rate_type} ↔ output=${output.period}/${output.aggregation}`
      it(name, async function () {
        this.timeout(40000)
        await assert_output_parity({
          column_id,
          params_legacy: { ...params, rate_type: [rate_type] },
          params_native: { ...params, output },
          splits,
          where
        })
      })
    }
  })
})
