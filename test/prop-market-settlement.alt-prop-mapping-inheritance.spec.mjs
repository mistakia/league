/* global describe, it */

import * as chai from 'chai'

import {
  market_type_mappings,
  get_handler_for_market_type,
  HANDLER_TYPES
} from '#libs-server/prop-market-settlement/market-type-mappings.mjs'
import {
  player_game_prop_types,
  player_game_alt_prop_types,
  player_quarter_alt_prop_types
} from '#libs-shared/bookmaker-constants.mjs'

const expect = chai.expect

// Placing a constant in `player_game_alt_prop_types` is not inert. A derivation
// loop in market-type-mappings.mjs strips `_ALT_` from each key, looks the base
// up in `player_game_prop_types`, and COPIES the base mapping when that base is
// already supported. So the group a new alt constant is declared in silently
// decides whether settlement will grade it.
//
// The class is enumerated from the group that defines it rather than from the
// names of whichever constants prompted this spec, because the loop reaches
// every member of the group and a name-scoped check would confirm only the
// members that happen to be named alike.
//
// The quarter alts are excluded here because they resolve their bases through
// the per-quarter groups in a second loop, not through
// `player_game_prop_types`.
describe('prop market settlement alt prop mapping inheritance', function () {
  const game_alt_keys = Object.keys(player_game_alt_prop_types).filter(
    (key) => !Object.hasOwn(player_quarter_alt_prop_types, key)
  )

  it('has alt constants to check, so the enumeration is not vacuous', function () {
    expect(game_alt_keys.length).to.be.greaterThan(10)
  })

  it('copies the base mapping exactly when the base is supported', function () {
    let inherited = 0

    for (const key of game_alt_keys) {
      const base_key = key.replace('_ALT_', '_')
      const base_type = player_game_prop_types[base_key]
      const base_mapping = market_type_mappings[base_type]

      if (!base_mapping || base_mapping.handler === HANDLER_TYPES.UNSUPPORTED) {
        continue
      }

      inherited += 1
      expect(
        market_type_mappings[player_game_alt_prop_types[key]],
        `${key} should inherit the mapping of ${base_key}`
      ).to.deep.equal(base_mapping)
    }

    expect(inherited, 'at least one alt type should inherit').to.be.greaterThan(
      0
    )
  })

  it('leaves an alt type unsupported when its base is unmapped', function () {
    for (const key of game_alt_keys) {
      const base_key = key.replace('_ALT_', '_')
      const base_mapping =
        market_type_mappings[player_game_prop_types[base_key]]

      if (base_mapping && base_mapping.handler !== HANDLER_TYPES.UNSUPPORTED) {
        continue
      }

      expect(
        get_handler_for_market_type(player_game_alt_prop_types[key]),
        `${key} has no supported base and must not be graded`
      ).to.equal(HANDLER_TYPES.UNSUPPORTED)
    }
  })

  // The Caesars kicking family, which is what made the rule above load-bearing.
  // The three alts were added together and only one of them inherits, so a
  // single blanket assertion in either direction would have been wrong.
  describe('the kicking family', function () {
    it('grades alt field goals made off the same handler and columns as its base', function () {
      expect(market_type_mappings.GAME_ALT_FIELD_GOALS_MADE).to.deep.equal(
        market_type_mappings.GAME_FIELD_GOALS_MADE
      )
      expect(get_handler_for_market_type('GAME_ALT_FIELD_GOALS_MADE')).to.equal(
        HANDLER_TYPES.PLAYER_GAMELOG
      )
    })

    it('leaves the kicking points and extra points constants unsupported', function () {
      for (const market_type of [
        'GAME_KICKING_POINTS',
        'GAME_ALT_KICKING_POINTS',
        'GAME_EXTRA_POINTS_MADE',
        'GAME_ALT_EXTRA_POINTS_MADE'
      ]) {
        expect(get_handler_for_market_type(market_type)).to.equal(
          HANDLER_TYPES.UNSUPPORTED
        )
      }
    })
  })

  // Coining a constant makes a market READABLE -- it reaches the data-view
  // betting columns and historical hit rate -- without making it GRADED. These
  // period-scoped lines have no settlement handler and must not acquire one by
  // accident, because the failure mode is silent: grading a first-half line
  // against the full-game result produces a plausible number.
  describe('the period-scoped game lines are readable but not graded', function () {
    it('resolves every one of them to UNSUPPORTED', function () {
      for (const market_type of [
        'GAME_FIRST_HALF_MONEYLINE',
        'GAME_FIRST_HALF_TOTAL',
        'GAME_SECOND_HALF_SPREAD',
        'GAME_SECOND_HALF_MONEYLINE',
        'GAME_SECOND_HALF_TOTAL',
        'GAME_FIRST_QUARTER_SPREAD',
        'GAME_FIRST_QUARTER_MONEYLINE',
        'GAME_FIRST_QUARTER_TOTAL'
      ]) {
        expect(
          get_handler_for_market_type(market_type),
          `${market_type} has no half or quarter aware handler yet`
        ).to.equal(HANDLER_TYPES.UNSUPPORTED)
      }
    })
  })
})
