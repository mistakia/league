/* global describe it */

import * as chai from 'chai'

import { SHARE_LINK_URL_SCHEMA } from 'react-table/src/constants.mjs'
import parse_table_state_from_url, {
  LEGACY_URL_PARAM_ALIASES
} from '#app/core/data-views/parse-table-state-from-url.mjs'

const expect = chai.expect

// First spec coverage for the client URL parser, which held the entire blast
// radius of the June 2026 `splits` -> `row_axes` rename and had none. The rename
// shipped a compat rule on the versioned localStorage path (`v2_to_v3` in
// libs-shared/data-view-storage/migrations.mjs) -- but a URL query string carries
// no version field and never enters that chain, so 188 of the 682 production
// short URLs rendered at the wrong grain for six weeks and three of them
// produced unexecutable SQL. Fixed reactively in 924dfe328.
//
// Note this module needs no webpack alias harness: it imports only `#`-prefixed
// specifiers and bare `react-table/...` paths, all of which Node resolves
// natively through the two packages' `imports` fields. The 130 of 231 app/core
// files that DO reach for `@core` / `@components` remain un-importable here.

const params = (object) => new URLSearchParams(object)
const json = (value) => JSON.stringify(value)

describe('data-views parse_table_state_from_url', function () {
  describe('legacy param aliases', function () {
    it('every alias target is a real table_state key', function () {
      for (const [legacy_key, target_key] of Object.entries(
        LEGACY_URL_PARAM_ALIASES
      )) {
        expect(
          SHARE_LINK_URL_SCHEMA.table_state[target_key],
          `alias ${legacy_key} -> ${target_key}`
        ).to.exist
      }
    })

    it('no alias shadows a key the schema still accepts', function () {
      for (const legacy_key of Object.keys(LEGACY_URL_PARAM_ALIASES)) {
        expect(
          SHARE_LINK_URL_SCHEMA.table_state[legacy_key],
          `legacy key ${legacy_key} is still live in the schema`
        ).to.not.exist
      }
    })

    it('reads row_axes from a legacy splits param', function () {
      const result = parse_table_state_from_url(
        params({ splits: json(['week']) })
      )
      expect(result.row_axes).to.eql(['week'])
    })

    it('reads a multi-axis legacy splits param', function () {
      const result = parse_table_state_from_url(
        params({ splits: json(['year', 'week']) })
      )
      expect(result.row_axes).to.eql(['year', 'week'])
    })

    it('prefers a present row_axes over splits', function () {
      const result = parse_table_state_from_url(
        params({ row_axes: json(['year']), splits: json(['week']) })
      )
      expect(result.row_axes).to.eql(['year'])
    })

    it('falls back to splits when row_axes is explicitly empty', function () {
      // The schema parser fabricates `[]` for an absent key, so an empty
      // row_axes is indistinguishable from a missing one and must defer.
      const result = parse_table_state_from_url(
        params({ row_axes: json([]), splits: json(['week']) })
      )
      expect(result.row_axes).to.eql(['week'])
    })

    it('yields no axes when neither key is present', function () {
      const result = parse_table_state_from_url(params({}))
      expect(result.row_axes).to.eql([])
    })

    it('yields no axes for malformed splits JSON', function () {
      const result = parse_table_state_from_url(params({ splits: '{not json' }))
      expect(result.row_axes).to.eql([])
    })

    it('yields no axes for a non-array splits value', function () {
      const result = parse_table_state_from_url(
        params({ splits: json({ week: true }) })
      )
      expect(result.row_axes).to.eql([])
    })

    it('yields no axes for an empty splits value', function () {
      const result = parse_table_state_from_url(params({ splits: '' }))
      expect(result.row_axes).to.eql([])
    })

    it('yields no axes for a non-array row_axes value', function () {
      // The schema parser only falls back for absent or unparseable input, so a
      // well-formed non-array reaches the caller unless the parser guards it.
      const result = parse_table_state_from_url(
        params({ row_axes: json({ week: true }) })
      )
      expect(result.row_axes).to.eql([])
    })
  })

  describe('table_state parsing', function () {
    it('defaults row_grain to player', function () {
      expect(parse_table_state_from_url(params({})).row_grain).to.eql([
        'player'
      ])
      expect(
        parse_table_state_from_url(params({ row_grain: json([]) })).row_grain
      ).to.eql(['player'])
    })

    it('reads an explicit row_grain', function () {
      const result = parse_table_state_from_url(
        params({ row_grain: json(['team']) })
      )
      expect(result.row_grain).to.eql(['team'])
    })

    it('parses columns, where and sort', function () {
      const result = parse_table_state_from_url(
        params({
          columns: json(['player_age']),
          where: json([
            { column_id: 'player_age', operator: '>', value: '25' }
          ]),
          sort: json([{ column_id: 'player_age', desc: true }])
        })
      )
      expect(result.columns).to.eql(['player_age'])
      expect(result.where).to.have.lengthOf(1)
      expect(result.sort).to.eql([{ column_id: 'player_age', desc: true }])
    })

    it('degrades malformed array params to empty rather than throwing', function () {
      const result = parse_table_state_from_url(
        params({ columns: '{not json', where: '{not json', sort: '{not json' })
      )
      expect(result.columns).to.eql([])
      expect(result.where).to.eql([])
      expect(result.sort).to.eql([])
    })

    it('parses the boolean and object params', function () {
      const enabled = parse_table_state_from_url(
        params({
          disable_scatter_plot: 'true',
          scatter_plot_options: json({ x_column_id: 'player_age' })
        })
      )
      expect(enabled.disable_scatter_plot).to.equal(true)
      expect(enabled.scatter_plot_options).to.eql({
        x_column_id: 'player_age'
      })

      const absent = parse_table_state_from_url(params({}))
      expect(absent.disable_scatter_plot).to.equal(false)
      expect(absent.scatter_plot_options).to.eql({})
    })

    it('reads the view fields', function () {
      const result = parse_table_state_from_url(
        params({
          view_id: 'abc',
          view_name: 'My View',
          view_description: 'notes',
          view_search_column_id: 'player_name'
        })
      )
      expect(result.view_id).to.equal('abc')
      expect(result.view_name).to.equal('My View')
      expect(result.view_description).to.equal('notes')
      expect(result.view_search_column_id).to.equal('player_name')
    })

    it('returns a key for every table_state key the schema declares', function () {
      const result = parse_table_state_from_url(params({}))
      for (const key of Object.keys(SHARE_LINK_URL_SCHEMA.table_state)) {
        expect(result, `table_state key ${key}`).to.have.property(key)
      }
    })
  })
})
