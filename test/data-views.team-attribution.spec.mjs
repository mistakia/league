/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'
import {
  resolve_team_join_target as active_resolve_team_join_target,
  consumes_params as aggregator_rate_consumes_params
} from '#libs-server/data-views/output-aggregator/aggregator-rate.mjs'
import {
  resolve_team_join_target as passive_resolve_team_join_target,
  get_team_attribution
} from '#libs-server/data-views/resolve-team-join-target.mjs'
import { get_per_team_play_cte_table_name } from '#libs-server/data-views/rate-type/rate-type-per-team-play.mjs'
import { requires_wrap } from '#libs-server/data-views/rate-type/per-team-play-wrap.mjs'
import { consumed_params_signature } from '#libs-server/data-views/output-aggregator/consumed-params-signature.mjs'

const expect = chai.expect

// team_attribution selects which team a player-cell team RATE stat attaches to:
//   'historical' (default) -> the player's per-year team-of-record, via the
//      player_year->team_year bridge (player_year_teams.team)
//   'current'              -> player.current_nfl_team (forward-looking projection)
// honored identically across numerator + denominator for both team rate types
// (per_game, per_team_play). The acceptance bar is the consistency invariant:
// flipping the param flips BOTH halves together. These assert SQL shape
// (query.toString()); population-level value checks run at live verification
// against prod data (the bundled test DB seeds players only, no plays/games).

const team_column = ({ period, year, team_attribution, splits = [] }) => {
  const params = {
    year,
    output: { period, aggregation: 'rate', threshold: null }
  }
  if (team_attribution) params.team_attribution = team_attribution
  return {
    column_id: 'team_pass_attempts_from_plays',
    params
  }
}

const view = (columns, { splits = [] } = {}) => ({
  columns,
  sort: [],
  where: [],
  splits
})

describe('data-views team_attribution', () => {
  describe('consistency invariant: numerator and denominator share one team', () => {
    it('per_game historical (default): both halves project via the bridge', async () => {
      const { query } = await get_data_view_results_query(
        view([team_column({ period: 'game', year: [2024] })])
      )
      const sql = query.toString()
      // numerator (aggregator-rate) and denominator (per-game games CTE) both
      // resolve onto player_year_teams.team -- and neither onto current_nfl_team
      expect(sql).to.match(/"team_code" = "player_year_teams"\."team"/)
      expect(sql).to.match(/"team" = "player_year_teams"\."team"/)
      expect(sql).to.not.match(/"player"\."current_nfl_team"/)
    })

    it('per_game current: both halves project onto current_nfl_team', async () => {
      const { query } = await get_data_view_results_query(
        view([
          team_column({ period: 'game', year: [2024], team_attribution: 'current' })
        ])
      )
      const sql = query.toString()
      expect(sql).to.match(/"team_code" = "player"\."current_nfl_team"/)
      expect(sql).to.match(/"team" = "player"\."current_nfl_team"/)
      // current mode must NOT register or join the historical bridge
      expect(sql).to.not.match(/"player_year_teams"/)
    })

    it('per_team_play historical (single year, no wrap): both halves via the bridge', async () => {
      const { query } = await get_data_view_results_query(
        view([team_column({ period: 'team_play', year: [2024] })])
      )
      const sql = query.toString()
      // numerator via active resolver, denominator via passive resolver --
      // both land on player_year_teams.team
      expect(sql).to.match(/"team_code" = "player_year_teams"\."team"/)
      expect(sql).to.match(/"off" = "player_year_teams"\."team"/)
      expect(sql).to.not.match(/"player"\."current_nfl_team"/)
    })

    it('per_team_play current (single year): both halves onto current_nfl_team', async () => {
      const { query } = await get_data_view_results_query(
        view([
          team_column({
            period: 'team_play',
            year: [2024],
            team_attribution: 'current'
          })
        ])
      )
      const sql = query.toString()
      expect(sql).to.match(/"team_code" = "player"\."current_nfl_team"/)
      expect(sql).to.match(/"off" = "player"\."current_nfl_team"/)
      expect(sql).to.not.match(/"player_year_teams"/)
    })
  })

  describe('per_team_play wrap is gated on team_attribution (drift fix)', () => {
    // The wrap (per-team-play-wrap.mjs) is a SECOND historical-attribution
    // mechanism: for a player subject over 2+ years with no year split it
    // materializes a CTE that INNER JOINs player_year_teams to attribute each
    // year's volume to that year's team. 'current' has nothing to attribute
    // per-year (all volume -> current_nfl_team), so the wrap must be skipped.
    // Driven at the unit level: with no effective scope, requires_wrap falls
    // back to query_context.year_range for the distinct-year count.
    const multi_year_ctx = {
      splits: [],
      nfl_week_ids: [],
      year_range: [2023, 2024, 2025]
    }

    it('historical multi-year-no-split player subject engages the wrap', () => {
      expect(
        requires_wrap({
          query_context: multi_year_ctx,
          params: {},
          identity_id: 'player'
        })
      ).to.equal(true)
    })

    it('current attribution skips the wrap for the same context', () => {
      expect(
        requires_wrap({
          query_context: multi_year_ctx,
          params: { team_attribution: 'current' },
          identity_id: 'player'
        })
      ).to.equal(false)
    })
  })

  describe('cross-column non-leak: a current column is not dragged onto a sibling bridge', () => {
    it('per_game: one historical + one current column resolve to DIFFERENT teams', async () => {
      const { query } = await get_data_view_results_query(
        view([
          team_column({ period: 'game', year: [2024] }),
          team_column({ period: 'game', year: [2024], team_attribution: 'current' })
        ])
      )
      const sql = query.toString()
      // historical column keeps the bridge; current column keeps current_nfl_team.
      // If the current column leaked onto the sibling's bridge there would be NO
      // current_nfl_team reference at all.
      expect(sql).to.match(/"player_year_teams"\."team"/)
      expect(sql).to.match(/"player"\."current_nfl_team"/)
    })

    it('per_team_play: one historical + one current column resolve to DIFFERENT teams', async () => {
      const { query } = await get_data_view_results_query(
        view([
          team_column({ period: 'team_play', year: [2024] }),
          team_column({
            period: 'team_play',
            year: [2024],
            team_attribution: 'current'
          })
        ])
      )
      const sql = query.toString()
      // the current column joins current_nfl_team even though the historical
      // sibling registered the player_year_teams bridge -- no cross-column leak
      expect(sql).to.match(/"off" = "player_year_teams"\."team"/)
      expect(sql).to.match(/"off" = "player"\."current_nfl_team"/)
    })
  })

  describe('resolver parity: the duplicated current branch cannot drift', () => {
    // The active (aggregator-rate) and passive (resolve-team-join-target)
    // resolvers carry the same two-line 'current' branch. Assert they agree for
    // every mode where they are contractually identical so the duplication is
    // pinned. (The historical default differs by mechanism -- active applies the
    // bridge and returns a literal, passive reads a registered CTE name -- and is
    // covered by the SQL-shape tests above.)
    const cases = [
      {
        label: 'current attribution (player cell)',
        active_ctx: { row_grain_id: 'player' },
        passive_ctx: { data_view_options: {} },
        params: { team_attribution: 'current' },
        expected: 'player.current_nfl_team'
      },
      {
        label: 'current_week opponent matchup',
        active_ctx: { row_grain_id: 'player' },
        passive_ctx: { data_view_options: {} },
        params: { matchup_opponent_type: 'current_week_opponent_total' },
        expected: 'current_week_opponents.opponent'
      },
      {
        label: 'next_week opponent matchup',
        active_ctx: { row_grain_id: 'player' },
        passive_ctx: { data_view_options: {} },
        params: { matchup_opponent_type: 'next_week_opponent_total' },
        expected: 'next_week_opponents.opponent'
      },
      {
        label: 'team subject',
        active_ctx: { row_grain_id: 'team', team_reference: 'nfl_team_subject' },
        passive_ctx: { team_reference: 'nfl_team_subject' },
        params: {},
        expected: 'nfl_team_subject'
      }
    ]

    for (const c of cases) {
      it(`${c.label}: active and passive resolvers agree`, () => {
        const active = active_resolve_team_join_target({
          query_context: c.active_ctx,
          params: c.params,
          source: null
        })
        const passive = passive_resolve_team_join_target({
          query_context: c.passive_ctx,
          params: c.params
        })
        expect(active).to.equal(c.expected)
        expect(passive).to.equal(c.expected)
      })
    }

    it('current mode beats a registered bridge CTE in the passive resolver', () => {
      // The cross-column leak guard at the unit level: even when a sibling
      // historical column already registered player_year_teams, a current
      // column resolves to current_nfl_team, not the bridge CTE.
      const ctx = {
        data_view_options: {},
        player_year_teams_cte_name: 'player_year_teams'
      }
      expect(
        passive_resolve_team_join_target({
          query_context: ctx,
          params: { team_attribution: 'current' }
        })
      ).to.equal('player.current_nfl_team')
      // sanity: historical still reads the registered bridge CTE
      expect(
        passive_resolve_team_join_target({ query_context: ctx, params: {} })
      ).to.equal('player_year_teams.team')
    })
  })

  describe('param plumbing', () => {
    it('get_team_attribution normalizes array, default, and unknown values', () => {
      expect(get_team_attribution({})).to.equal('historical')
      expect(get_team_attribution({ team_attribution: 'current' })).to.equal(
        'current'
      )
      expect(get_team_attribution({ team_attribution: ['current'] })).to.equal(
        'current'
      )
      // unknown values normalize to historical by falling through every
      // `=== 'current'` check (no validation throw)
      expect(get_team_attribution({ team_attribution: 'bogus' })).to.equal(
        'bogus'
      )
    })

    it('per_team_play denominator CTE name differs by team_attribution', () => {
      const historical = get_per_team_play_cte_table_name({
        params: { year: [2024] }
      })
      const current = get_per_team_play_cte_table_name({
        params: { year: [2024], team_attribution: 'current' }
      })
      expect(historical).to.not.equal(current)
      // historical default must stay byte-identical to the no-param name
      const no_param = get_per_team_play_cte_table_name({ params: {} })
      const historical_explicit = get_per_team_play_cte_table_name({
        params: { team_attribution: 'historical' }
      })
      expect(historical_explicit).to.equal(no_param)
    })

    it('aggregator-rate consumed-params signature differs by team_attribution', () => {
      const historical = consumed_params_signature({
        params: { year: [2024] },
        consumes_params: aggregator_rate_consumes_params
      })
      const current = consumed_params_signature({
        params: { year: [2024], team_attribution: 'current' },
        consumes_params: aggregator_rate_consumes_params
      })
      expect(historical).to.not.equal(current)
    })
  })
})
