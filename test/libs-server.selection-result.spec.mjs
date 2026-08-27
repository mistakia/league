/* global describe, it */
import * as chai from 'chai'

import { get_selection_result, is_hit } from '#libs-server/selection-result.mjs'
import {
  team_game_market_types,
  player_game_prop_types
} from '#libs-shared/bookmaker-constants.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

describe('LIBS-SERVER selection_result', function () {
  describe('team game outcome markets', function () {
    // These markets are settled by the NFL_GAMES handler in
    // prop-market-settlement, not here. This module previously carried a second
    // copy of that logic which no caller ever reached, and which read the
    // retired nfl_games.h/.v columns -- so once a caller DID supply game data it
    // graded a winning home moneyline as LOST. Falling through to the default
    // branch is what makes the omission legible to the caller.
    for (const market_type of [
      team_game_market_types.GAME_MONEYLINE,
      team_game_market_types.GAME_SPREAD,
      team_game_market_types.GAME_TOTAL
    ]) {
      it(`records ${market_type} as unsupported rather than grading it`, () => {
        const unsupported_market_types = new Set()

        const result = get_selection_result({
          line: 0,
          market_type,
          selection_type: 'OVER',
          player_gamelog: {},
          unsupported_market_types
        })

        expect(result).to.equal(null)
        expect([...unsupported_market_types]).to.deep.equal([market_type])
      })
    }
  })

  describe('player prop markets', function () {
    it('grades an OVER against the strict line', () => {
      const params = {
        line: 250.5,
        market_type: player_game_prop_types.GAME_PASSING_YARDS,
        selection_type: 'OVER',
        strict: true,
        player_gamelog: { passing_yards: 300 }
      }

      expect(get_selection_result(params)).to.equal('WON')
      expect(is_hit(params)).to.equal(true)
    })

    it('grades an exact match as a PUSH, which is not a hit', () => {
      const params = {
        line: 300,
        market_type: player_game_prop_types.GAME_PASSING_YARDS,
        selection_type: 'OVER',
        strict: true,
        player_gamelog: { passing_yards: 300 }
      }

      expect(get_selection_result(params)).to.equal('PUSH')
      expect(is_hit(params)).to.equal(false)
    })

    it('applies the non-strict cushion, capped at 16 passing yards', () => {
      const params = {
        line: 400,
        market_type: player_game_prop_types.GAME_PASSING_YARDS,
        selection_type: 'OVER',
        strict: false,
        player_gamelog: { passing_yards: 390 }
      }

      // 6% of 400 is 24, capped to 16, so the effective line is 384
      expect(get_selection_result(params)).to.equal('WON')
    })
  })
})
