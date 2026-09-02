/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'
import server_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
// Imported directly rather than through app/core/data-views-fields/index.js,
// which pulls in React components and webpack aliases and is not
// Node-importable. This one file has no such imports, so the contract can be
// checked against the real declarations instead of by parsing source text --
// the compromise data-view-player-field-parity.spec.mjs had to make.
import client_fields from '../app/core/data-views-fields/betting-market-table-fields.js'

const expect = chai.expect

// THE CONTRACT: a row axis a column OFFERS is a row axis the server can SERVE.
//
// The axis picker's options are the union of `row_axes` over the selected
// columns, so a declaration here is a promise made in the UI. Break it and the
// user picks a split that refuses the whole request -- and a refusal renders as
// one generic banner with the message dropped, so there is nothing on screen
// saying which column or which axis was at fault.
//
// The inverse gap is what this file was written for and it is silent in the
// other direction: a column can SERVE an axis it never OFFERS, which is not an
// error but is invisible. Every game-grain betting column served the week axis
// and declared nothing, so a props-only view had no Splits control at all and
// weekly props were reachable only by hand-writing the URL.
//
// Scoped to the betting families rather than swept across every field, because
// a whole-index sweep would gate this repo's push on the pre-existing state of
// twenty other column families. Widen it when someone is in a position to fix
// what it finds.
const BETTING_FIELD_PATTERN = /betting_markets|game_prop_historical/

// `row_axes` may be a plain array or a function of the column instance's
// params, resolved per instance by react-table. A field that declares the
// function form has to be CALLED to be checked -- reading the field alone would
// drop it out of this contract silently, which is exactly the confident-zero
// failure the guard below exists to catch.
const resolve_row_axes = (field, params) =>
  typeof field?.row_axes === 'function'
    ? field.row_axes(params)
    : field?.row_axes

// The two market shapes the offered set turns on. A ladder market posts many
// selections per player-game and so defines rungs to split a row along; a
// standard market posts exactly one and defines none.
const LADDER_PARAMS = { market_type: ['GAME_ALT_PASSING_YARDS'] }
const SINGLE_LINE_PARAMS = { market_type: ['GAME_PASSING_YARDS'] }

// A week axis is only ever requested alongside year -- the identity registry
// resolves `['week']` to the year+week identity anyway, so asking for week
// alone would test a request shape no client can produce. A line axis likewise
// only arrives under a game-grain view, which carries year and week.
const request_axes_for = (row_axis) => {
  if (row_axis === 'week') return ['year', 'week']
  if (row_axis === 'line') return ['year', 'week', 'line']
  return [row_axis]
}

const row_grain_for = (column_id) => {
  const declared = server_column_definitions[column_id]?.row_grains
  if (Array.isArray(declared) && declared.length) return [declared[0]]
  return ['player']
}

describe('data views row axes declaration contract', function () {
  const betting_fields = Object.entries(client_fields).filter(
    ([column_id, field]) => {
      if (!BETTING_FIELD_PATTERN.test(column_id)) return false
      const row_axes = resolve_row_axes(field, SINGLE_LINE_PARAMS)
      return Array.isArray(row_axes) && row_axes.length
    }
  )

  // Guards against the whole suite passing vacuously if the pattern stops
  // matching or the fields stop declaring axes -- the failure mode where a
  // contract test reports a confident zero.
  it('finds betting fields declaring row axes', () => {
    expect(betting_fields.length).to.be.greaterThan(5)
  })

  // The same guard for the conditional half. Making row_axes a function is what
  // lets a family withhold an axis, and a family that quietly reverts to a
  // constant array would still satisfy every assertion below.
  it('finds betting fields whose offered axes depend on their params', () => {
    const conditional = betting_fields.filter(
      ([, field]) => typeof field.row_axes === 'function'
    )
    expect(conditional.length).to.be.greaterThan(0)
  })

  for (const [column_id, field] of betting_fields) {
    for (const params of [SINGLE_LINE_PARAMS, LADDER_PARAMS]) {
      const market_type = params.market_type[0]
      for (const row_axis of resolve_row_axes(field, params)) {
        it(`serves ${row_axis} for ${column_id} under ${market_type}`, async () => {
          const { query } = await get_data_view_results_query({
            columns: [{ column_id, params }],
            prefix_columns: [],
            row_axes: request_axes_for(row_axis),
            row_grain: row_grain_for(column_id)
          })
          // Anchored on the axis being PROJECTED, not merely on the request not
          // throwing. A query that emits without the split column is the shape
          // the rung projection bug had: valid SQL, correct rows, blank axis.
          expect(String(query)).to.match(new RegExp(`"${row_axis}"`))
        })
      }
    }
  }

  // The conditional reveal itself, stated as a pair against a control so the
  // assertion cannot pass on a family that offers line unconditionally.
  describe('the line axis is offered only by a market that posts a ladder', () => {
    const game_prop_fields = [
      'player_game_prop_line_from_betting_markets',
      'player_game_prop_american_odds_from_betting_markets',
      'player_game_prop_decimal_odds_from_betting_markets',
      'player_game_prop_implied_probability_from_betting_markets',
      'player_game_prop_historical_hit_rate',
      'player_game_prop_historical_edge'
    ]

    for (const column_id of game_prop_fields) {
      it(`offers line on ${column_id} for a ladder market and not for a standard one`, () => {
        const field = client_fields[column_id]
        expect(resolve_row_axes(field, LADDER_PARAMS)).to.eql([
          'year',
          'week',
          'line'
        ])
        expect(resolve_row_axes(field, SINGLE_LINE_PARAMS)).to.eql([
          'year',
          'week'
        ])
      })
    }

    // A column carrying no explicit market_type takes its family's default,
    // which is a standard market. The server skips such a column when building
    // the rung domain, so offering line for it would promise a split with no
    // source behind it.
    it('withholds line from a column that names no market_type', () => {
      expect(
        resolve_row_axes(
          client_fields.player_game_prop_line_from_betting_markets,
          {}
        )
      ).to.eql(['year', 'week'])
    })

    // Team markets are not in the line axis domain at all -- the server's
    // source resolution filters on is_player_game_prop, so a team column
    // contributes no rungs whatever its market_type is.
    it('withholds line from a team market', () => {
      expect(
        resolve_row_axes(
          client_fields.team_game_prop_line_from_betting_markets,
          LADDER_PARAMS
        )
      ).to.eql(['year', 'week'])
    })
  })

  // The season prop is the one betting column that declares year alone, and
  // that asymmetry is the point rather than an oversight: its line is one value
  // for the season, so week is not a split it can offer.
  it('does not offer week on the season prop', () => {
    expect(
      client_fields.player_season_prop_line_from_betting_markets.row_axes
    ).to.eql(['year'])
  })
})
