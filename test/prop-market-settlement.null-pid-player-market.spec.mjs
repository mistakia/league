/* global describe it */
import * as chai from 'chai'

import { NFLPlaysMarketHandler } from '#libs-server/prop-market-settlement/worker/market-data-handlers.mjs'

const expect = chai.expect

// A player market carrying no selection_pid is UNGRADABLE. It used to grade.
//
// _filter_plays_for_market applied the player filter only `if
// (market.selection_pid)`, so a null pid skipped it entirely and the
// aggregation ran over every play in the game. The two aggregation shapes fail
// differently and both look plausible in the output:
//
//   MAX      -> the game's longest play by ANY player
//   period   -> the period's total across ALL players
//
// Measured against production before the guard landed: 1,320 already-graded
// null-pid selections across FanDuel, DraftKings, Pinnacle and Caesars, and
// every one of them equalled the whole-population aggregate exactly -- 354 on
// the MAX arms and the remainder on the quarter- and half-scoped arms. One
// Longest Reception selection was marked WON for a player who held no gamelog
// for the game at all.
//
// These fixtures are DISCRIMINATING PAIRS. Each names a player who did
// something small and another who did something large, so the whole-population
// answer and the correct per-player answer are different numbers. A fixture
// where the two coincide cannot tell the fix from its absence.

const build_reception_plays = () => [
  {
    esbid: 'G1',
    quarter: 1,
    target_pid: 'SMAL-PLAY-000001',
    receiving_yards: 8,
    is_completion: true
  },
  {
    esbid: 'G1',
    quarter: 1,
    target_pid: 'BIGG-PLAY-000002',
    receiving_yards: 60,
    is_completion: true
  }
]

const build_market = ({ market_type, selection_pid }) => ({
  esbid: 'G1',
  source_market_id: 'M1',
  market_type,
  selection_pid,
  selection_type: 'OVER',
  selection_metric_line: 0.5,
  time_type: 'CLOSE'
})

describe('prop market settlement: a player market with no pid', function () {
  describe('the MAX arm', function () {
    it('grades the named player against his own longest reception', function () {
      const handler = new NFLPlaysMarketHandler(build_reception_plays())
      const results = handler._process_single_market(
        build_market({
          market_type: 'GAME_LONGEST_RECEPTION',
          selection_pid: 'SMAL-PLAY-000001'
        })
      )

      // 8, not 60 -- the control that proves the fixture can distinguish.
      expect(results[0].metric_value).to.equal(8)
    })

    it('refuses a null pid rather than returning the game-wide longest', function () {
      const handler = new NFLPlaysMarketHandler(build_reception_plays())

      expect(() =>
        handler._process_single_market(
          build_market({
            market_type: 'GAME_LONGEST_RECEPTION',
            selection_pid: null
          })
        )
      ).to.throw(/no selection_pid/)
    })
  })

  describe('the period-scoped arm', function () {
    const first_quarter_plays = [
      {
        esbid: 'G1',
        quarter: 1,
        ball_carrier_pid: 'SMAL-PLAY-000001',
        rush_yards: 3
      },
      {
        esbid: 'G1',
        quarter: 1,
        ball_carrier_pid: 'BIGG-PLAY-000002',
        rush_yards: 40
      }
    ]

    it('grades the named player against his own first-quarter rushing', function () {
      const handler = new NFLPlaysMarketHandler(first_quarter_plays)
      const results = handler._process_single_market(
        build_market({
          market_type: 'GAME_FIRST_QUARTER_RUSHING_YARDS',
          selection_pid: 'SMAL-PLAY-000001'
        })
      )

      // 3, not the 43 the period-wide sum would produce.
      expect(results[0].metric_value).to.equal(3)
    })

    it('refuses a null pid rather than summing the whole period', function () {
      const handler = new NFLPlaysMarketHandler(first_quarter_plays)

      expect(() =>
        handler._process_single_market(
          build_market({
            market_type: 'GAME_FIRST_QUARTER_RUSHING_YARDS',
            selection_pid: null
          })
        )
      ).to.throw(/no selection_pid/)
    })
  })

  // The guard must not reach a market that legitimately carries no pid. A
  // game-level market declares no player_column and returns before the check.
  it('leaves a game-level market with no player_column alone', function () {
    const handler = new NFLPlaysMarketHandler(build_reception_plays())

    expect(() =>
      handler._process_single_market(
        build_market({ market_type: 'GAME_TOTAL', selection_pid: null })
      )
    ).to.not.throw(/no selection_pid/)
  })
})
