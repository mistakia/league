/* global describe it */
import * as chai from 'chai'

import { identity_for } from '#libs-server/data-views/row-grain-registry.mjs'
import { get_identity } from '#libs-server/data-views/identities.mjs'
import {
  has_bridge,
  resolve as resolve_bridge
} from '#libs-server/data-views/identity-bridge-registry.mjs'
import {
  is_line_axis_active,
  resolve_line_axis_sources
} from '#libs-server/data-views/line-axis-sources.mjs'

const expect = chai.expect

describe('data views line row axis', function () {
  describe('identity resolution', function () {
    it('resolves the line identity under year, week and line', () => {
      expect(
        identity_for({
          row_grain_id: 'player',
          row_axes: ['year', 'week', 'line']
        })
      ).to.equal('player_year_week_line')
    })

    // The whole point of adding a branch to a function every existing request
    // already goes through: none of them may move.
    it('leaves the existing player resolutions unchanged', () => {
      expect(identity_for({ row_grain_id: 'player', row_axes: [] })).to.equal(
        'player'
      )
      expect(
        identity_for({ row_grain_id: 'player', row_axes: ['year'] })
      ).to.equal('player_year')
      expect(
        identity_for({ row_grain_id: 'player', row_axes: ['year', 'week'] })
      ).to.equal('player_year_week')
      expect(
        identity_for({ row_grain_id: 'player', row_axes: ['week'] })
      ).to.equal('player_year_week')
    })

    it('leaves the existing team resolutions unchanged', () => {
      expect(identity_for({ row_grain_id: 'team', row_axes: [] })).to.equal(
        'team'
      )
      expect(
        identity_for({ row_grain_id: 'team', row_axes: ['year'] })
      ).to.equal('team_year')
      expect(
        identity_for({ row_grain_id: 'team', row_axes: ['year', 'week'] })
      ).to.equal('team_year_week')
    })

    it('refuses a line axis without a week axis', () => {
      expect(() =>
        identity_for({ row_grain_id: 'player', row_axes: ['year', 'line'] })
      ).to.throw(/requires 'week'/)
    })

    it('refuses a line axis at team grain', () => {
      expect(() =>
        identity_for({
          row_grain_id: 'team',
          row_axes: ['year', 'week', 'line']
        })
      ).to.throw(/not supported for row_grain 'team'/)
    })
  })

  describe('identity shape', function () {
    it('keys on the line alongside pid, year and week', () => {
      const identity = get_identity('player_year_week_line')
      expect(identity.key_columns).to.eql([
        'pid',
        'year',
        'week',
        'selection_metric_line'
      ])
      expect(identity.row_axes).to.eql(['year', 'week', 'line'])
      expect(identity.row_grain).to.equal('player')
    })

    // year and week deliberately reference the week relation rather than the
    // line CTE; see the identity's comment for why the shallower one is safe.
    it('sources year and week from the week relation', () => {
      const identity = get_identity('player_year_week_line')
      expect(identity.year_column).to.equal('player_years_weeks.year')
      expect(identity.week_column).to.equal('player_years_weeks.week')
      expect(identity.line_column).to.equal(
        'player_years_weeks_lines.selection_metric_line'
      )
    })
  })

  describe('bridge registration', function () {
    it('registers a bridge from the week identity to the line identity', () => {
      expect(has_bridge('player_year_week', 'player_year_week_line')).to.equal(
        true
      )
      const bridge = resolve_bridge('player_year_week', 'player_year_week_line')
      expect(bridge.from).to.equal('player_year_week')
      expect(bridge.to).to.equal('player_year_week_line')
    })

    // A line axis whose rungs nothing defines is an un-answerable request, and
    // an empty domain would render an empty view that reads like "no data".
    it('refuses to build the rung CTE with no market source', () => {
      const bridge = resolve_bridge('player_year_week', 'player_year_week_line')
      const query_context = {
        players_query: {
          with: () => {
            throw new Error('should not register a CTE')
          }
        },
        registered_ctes: new Set(),
        line_axis_sources: [],
        year_range: [2024],
        week_range: [1]
      }
      expect(() => bridge.add_cte({ query_context })).to.throw(
        /nothing defines the rungs/
      )
    })
  })

  describe('line axis source resolution', function () {
    const data_views_column_definitions = {
      player_game_prop_line_from_betting_markets: {
        is_player_game_prop: true
      },
      player_game_prop_american_odds_from_betting_markets: {
        is_player_game_prop: true
      },
      player_week_projected_points: {}
    }

    it('is inactive without the axis', () => {
      expect(is_line_axis_active([])).to.equal(false)
      expect(is_line_axis_active(['year', 'week'])).to.equal(false)
      expect(is_line_axis_active(['year', 'week', 'line'])).to.equal(true)
    })

    it('reads market selectors off betting columns only', () => {
      const sources = resolve_line_axis_sources({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: {
              market_type: ['GAME_ALT_PASSING_YARDS'],
              source_id: ['FANDUEL'],
              time_type: ['CLOSE'],
              selection_type: ['OVER']
            }
          },
          { column_id: 'player_week_projected_points', params: {} }
        ],
        data_views_column_definitions
      })
      expect(sources).to.have.length(1)
      expect(sources[0].market_type).to.eql(['GAME_ALT_PASSING_YARDS'])
      expect(sources[0].source_id).to.eql(['FANDUEL'])
    })

    // Line and odds on one market are one domain entry, not two: they select
    // the same selections, so unioning them twice would be unioning the rung
    // set with itself.
    it('collapses two columns reading different values of one market', () => {
      const params = {
        market_type: ['GAME_ALT_PASSING_YARDS'],
        source_id: ['FANDUEL'],
        time_type: ['CLOSE'],
        selection_type: ['OVER']
      }
      const sources = resolve_line_axis_sources({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params
          },
          {
            column_id: 'player_game_prop_american_odds_from_betting_markets',
            params
          }
        ],
        data_views_column_definitions
      })
      expect(sources).to.have.length(1)
    })

    // Two books on one market type is the line-shopping case and must produce
    // two arms, so the rung domain is their union.
    it('keeps two books on one market type as two sources', () => {
      const sources = resolve_line_axis_sources({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: {
              market_type: ['GAME_ALT_PASSING_YARDS'],
              source_id: ['FANDUEL']
            }
          },
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: {
              market_type: ['GAME_ALT_PASSING_YARDS'],
              source_id: ['DRAFTKINGS']
            }
          }
        ],
        data_views_column_definitions
      })
      expect(sources).to.have.length(2)
    })

    // A betting column naming no market_type takes a single-line default and
    // contributes no rungs, so it must not enter the domain.
    it('skips a betting column with no explicit market_type', () => {
      const sources = resolve_line_axis_sources({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: { source_id: ['FANDUEL'] }
          }
        ],
        data_views_column_definitions
      })
      expect(sources).to.have.length(0)
    })
  })
})
