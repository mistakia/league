/* global describe it */
import * as chai from 'chai'

import { parse_game_team_total_market_id } from '#libs-server/get-game-team-implied-totals.mjs'

const expect = chai.expect

// GAME_TEAM_TOTAL rows carry NO team column and their source_market_name is
// literally "description: undefined". The encoded source_market_id is the only
// place the side and the line exist, so this parser is the whole interface to
// the largest DST scoring component.
//
// The period digit is the part that matters. The same event publishes team
// totals for the full game, the first half and a quarter, and the short-period
// lines (3.5, 9.5, 12.5) are all plausible-looking numbers. Reading a quarter
// line as a game total would project a 3.5-point opponent -- a near shutout for
// every defense, every week -- with nothing to signal it.

describe('LIBS-SERVER parse_game_team_total_market_id', function () {
  it('parses a full-game team total', function () {
    expect(
      parse_game_team_total_market_id('1614603339/s;0;tt;20.5;home')
    ).to.deep.equal({ line: 20.5, side: 'home' })

    expect(
      parse_game_team_total_market_id('1614603339/s;0;tt;23.5;away')
    ).to.deep.equal({ line: 23.5, side: 'away' })
  })

  it('rejects short-period markets rather than reading them as game totals', function () {
    // First half.
    expect(
      parse_game_team_total_market_id('1614603339/s;1;tt;9.5;home')
    ).to.equal(null)
    // Quarter.
    expect(
      parse_game_team_total_market_id('1614603339/s;3;tt;3.5;away')
    ).to.equal(null)
  })

  it('parses an integer line', function () {
    expect(
      parse_game_team_total_market_id('1610163842/s;0;tt;24;home')
    ).to.deep.equal({ line: 24, side: 'home' })
  })

  it('returns null on anything that is not this shape', function () {
    expect(parse_game_team_total_market_id(null)).to.equal(null)
    expect(parse_game_team_total_market_id('')).to.equal(null)
    expect(
      parse_game_team_total_market_id('1614603339/s;0;sp;3.5;home')
    ).to.equal(null)
    // Trailing content means the format changed; do not guess.
    expect(
      parse_game_team_total_market_id('1614603339/s;0;tt;20.5;home;extra')
    ).to.equal(null)
  })
})
