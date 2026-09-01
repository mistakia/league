/* global describe, it */

import * as chai from 'chai'

import { bookmaker_constants } from '#libs-shared'
import betting_market_columns from '#libs-server/data-views-column-definitions/player-betting-market-column-definitions.mjs'
import data_views_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
import betting_market_table_fields from '@core/data-views-fields/betting-market-table-fields.js'

const expect = chai.expect

// The defect these assertions pin, measured on production 2026-09-01:
// `/u/cab3be30d0f082df5cbf9e3c1fd3ee14` carried
// `player_game_prop_line_from_betting_markets` with `market_type
// ANYTIME_TOUCHDOWN` and `selection_type OVER`. FanDuel's 7,694 CLOSE
// ANYTIME_TOUCHDOWN selections for 2025 are ALL stored as selection_type YES,
// so the column matched nothing and returned null on every row -- which the
// week-grain participation renderer then displayed as 0.
//
// Two independent halves, so two independent sets of assertions: the param
// declaration (which values the market admits) and the null semantics (what an
// unmatched row is allowed to render as).

const GAME_PROP_COLUMN_IDS = [
  'player_game_prop_line_from_betting_markets',
  'player_game_prop_american_odds_from_betting_markets',
  'player_game_prop_decimal_odds_from_betting_markets',
  'player_game_prop_implied_probability_from_betting_markets'
]

const get_selection_type_param = (column_id) =>
  betting_market_table_fields[column_id]?.column_params?.selection_type

describe('betting market param consistency', function () {
  describe('selection_type admissible values follow market_type', function () {
    for (const column_id of GAME_PROP_COLUMN_IDS) {
      it(`${column_id} admits YES/NO for a yes/no market`, function () {
        const param = get_selection_type_param(column_id)
        expect(param, 'selection_type param is declared').to.exist
        expect(param.get_values, 'get_values is declared').to.be.a('function')

        expect(
          param.get_values({ market_type: ['ANYTIME_TOUCHDOWN'] })
        ).to.deep.equal(['YES', 'NO'])
      })

      it(`${column_id} admits OVER/UNDER for an over/under market`, function () {
        // The control for the assertion above: same param, same call shape,
        // only the market moved. A get_values that stopped branching would
        // fail one of the two.
        const param = get_selection_type_param(column_id)
        expect(
          param.get_values({ market_type: ['GAME_PASSING_YARDS'] })
        ).to.deep.equal(['OVER', 'UNDER'])
      })
    }

    it('never admits OVER for any yes/no market type', function () {
      // Declaration-driven rather than a fixed list, so a market added to
      // yes_no_market_types later is covered without editing this spec.
      const param = get_selection_type_param(
        'player_game_prop_line_from_betting_markets'
      )
      const yes_no_market_types = [...bookmaker_constants.yes_no_market_types]
      expect(yes_no_market_types.length, 'the set is non-empty').to.be.above(0)

      for (const market_type of yes_no_market_types) {
        const admissible = param.get_values({ market_type: [market_type] })
        expect(admissible, `${market_type} admits no OVER`).to.not.include(
          'OVER'
        )
        expect(admissible, `${market_type} admits no UNDER`).to.not.include(
          'UNDER'
        )
      }
    })

    it('reads market_type as a scalar as well as a single-element list', function () {
      // The param is `single`, so it is normally stored as a one-element list;
      // a stored scalar is a data quirk the reader has to absorb.
      const param = get_selection_type_param(
        'player_game_prop_line_from_betting_markets'
      )
      expect(
        param.get_values({ market_type: 'ANYTIME_TOUCHDOWN' })
      ).to.deep.equal(['YES', 'NO'])
    })

    it('defaults to the selection type the admissible set contains', function () {
      const param = get_selection_type_param(
        'player_game_prop_line_from_betting_markets'
      )
      for (const market_type of ['ANYTIME_TOUCHDOWN', 'GAME_PASSING_YARDS']) {
        const params = { market_type: [market_type] }
        expect(
          param.get_values(params),
          `${market_type} default is admissible`
        ).to.include(param.get_default_value(params))
      }
    })
  })

  describe('null semantics', function () {
    it('declares null_means_no_source on every betting market client field', function () {
      const betting_field_ids = Object.keys(betting_market_table_fields)
      expect(betting_field_ids.length, 'the registry is non-empty').to.be.above(
        0
      )

      for (const column_id of betting_field_ids) {
        expect(
          betting_market_table_fields[column_id].null_means_no_source,
          `${column_id} declares null_means_no_source`
        ).to.equal(true)
      }
    })

    it('gives every server betting market column a resolvable export alias', function () {
      // The export route suppresses the participation marker for these columns
      // by deriving their result aliases from this module's exports. A column
      // whose select_as is not a function contributes no alias and would keep
      // exporting a manufactured 0, so the derivation has to reach all of them.
      const server_column_ids = Object.keys(betting_market_columns)
      expect(server_column_ids.length, 'the module is non-empty').to.be.above(0)

      for (const column_id of server_column_ids) {
        const definition = betting_market_columns[column_id]
        expect(definition.select_as, `${column_id} declares select_as`).to.be.a(
          'function'
        )
        expect(
          definition.select_as(),
          `${column_id} resolves a non-empty alias`
        ).to.be.a('string').and.not.empty
      }
    })

    it('produces aliases that do not collide with non-betting columns', function () {
      // The control: the export exclusion keys on the alias, so a betting alias
      // equal to some other column's alias would suppress the participation
      // marker on a column that genuinely wants it.
      const betting_aliases = new Set(
        Object.values(betting_market_columns)
          .filter((definition) => typeof definition?.select_as === 'function')
          .map((definition) => definition.select_as())
      )
      expect(betting_aliases.size, 'aliases were derived').to.be.above(0)

      const colliding = []
      for (const [column_id, definition] of Object.entries(
        data_views_column_definitions
      )) {
        if (betting_market_columns[column_id]) continue
        if (typeof definition?.select_as !== 'function') continue
        let alias
        try {
          alias = definition.select_as()
        } catch {
          // A select_as needing params cannot collide on a bare call; the
          // betting aliases are all parameterless constants.
          continue
        }
        if (betting_aliases.has(alias)) colliding.push(column_id)
      }

      expect(
        colliding,
        'no non-betting column shares a betting alias'
      ).to.deep.equal([])
    })
  })
})
