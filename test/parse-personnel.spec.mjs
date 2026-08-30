/* global describe, it */
import * as chai from 'chai'

import {
  parse_personnel_string,
  add_personnel_counts_to_play_data
} from '#libs-server/parse-personnel.mjs'

const expect = chai.expect

describe('parse_personnel_string', function () {
  describe('offense', function () {
    it('parses long format with explicit positions', function () {
      const result = parse_personnel_string({
        value: '1 RB, 1 TE, 3 WR',
        side: 'offense'
      })
      expect(result).to.deep.equal({ qb: 1, rb: 1, te: 1, wr: 3, ol: 5 })
    })

    it('parses long format with non-default QB and OL', function () {
      const result = parse_personnel_string({
        value: '6 OL, 2 QB, 1 RB, 0 TE, 2 WR',
        side: 'offense'
      })
      expect(result).to.deep.equal({ qb: 2, rb: 1, te: 0, wr: 2, ol: 6 })
    })

    // The two-digit short code is the charting vendor's vocabulary, not the NFL
    // feed's, and accepting it here is what let that vendor's values become
    // personnel counts on 3,507 rows. Zero rows in any of the 27 seasons carry
    // the shape, so this asserts the parser refuses it rather than that it is
    // merely unused -- an unused branch would re-admit the vocabulary the moment
    // someone restored the mapping.
    it('refuses the vendor two-digit short code', function () {
      expect(parse_personnel_string({ value: '11', side: 'offense' })).to.equal(
        null
      )
      expect(
        parse_personnel_string({ value: '01*', side: 'offense' })
      ).to.equal(null)
    })

    it('applies QB and OL defaults when absent', function () {
      expect(
        parse_personnel_string({ value: '2 RB, 2 TE, 1 WR', side: 'offense' })
      ).to.deep.equal({ qb: 1, rb: 2, te: 2, wr: 1, ol: 5 })
    })
  })

  describe('defense', function () {
    it('parses long format', function () {
      expect(
        parse_personnel_string({ value: '4 DL, 3 LB, 4 DB', side: 'defense' })
      ).to.deep.equal({ dl: 4, lb: 3, db: 4 })
    })

    // Same story as the offensive short code: package names are the charting
    // vendor's vocabulary, reaching 662 rows across the five values. 0-3DB and
    // 7+DB are here for a second reason -- the long-form pattern matched the
    // trailing `3DB` of `0-3DB` and returned { db: 3 } with the package softmap
    // uninvolved, so this case fails on the regex alone if the anchor is ever
    // relaxed, not just on the softmap being restored.
    it('refuses vendor defensive package names', function () {
      for (const value of ['Nickel', 'Dime', 'Base', '0-3DB', '7+DB']) {
        expect(parse_personnel_string({ value, side: 'defense' })).to.equal(
          null,
          value
        )
      }
    })
  })

  describe('null handling', function () {
    it('returns null for null input', function () {
      expect(parse_personnel_string({ value: null, side: 'offense' })).to.equal(
        null
      )
    })

    it('returns null for undefined input', function () {
      expect(
        parse_personnel_string({ value: undefined, side: 'offense' })
      ).to.equal(null)
    })

    it('returns null for empty string', function () {
      expect(parse_personnel_string({ value: '', side: 'offense' })).to.equal(
        null
      )
    })

    it('returns null for unparseable defensive labels', function () {
      expect(
        parse_personnel_string({ value: 'Other', side: 'defense' })
      ).to.equal(null)
    })

    it('throws on invalid side', function () {
      expect(() =>
        parse_personnel_string({ value: '1 RB', side: 'special' })
      ).to.throw()
    })
  })
})

describe('add_personnel_counts_to_play_data', function () {
  it('mutates a play row with offensive counts only when only offense_personnel present', function () {
    const play = { offense_personnel: '1 RB, 1 TE, 3 WR' }
    add_personnel_counts_to_play_data(play)
    expect(play.offense_personnel_running_back_count).to.equal(1)
    expect(play.offense_personnel_tight_end_count).to.equal(1)
    expect(play.offense_personnel_wide_receiver_count).to.equal(3)
    expect(play.offense_personnel_quarterback_count).to.equal(1)
    expect(play.offense_personnel_offensive_line_count).to.equal(5)
    expect(play).to.not.have.property('defense_personnel_defensive_line_count')
  })

  it('populates both sides when both strings present', function () {
    const play = {
      offense_personnel: '1 RB, 1 TE, 3 WR',
      defense_personnel: '4 DL, 3 LB, 4 DB'
    }
    add_personnel_counts_to_play_data(play)
    expect(play.defense_personnel_defensive_line_count).to.equal(4)
    expect(play.defense_personnel_linebacker_count).to.equal(3)
    expect(play.defense_personnel_defensive_back_count).to.equal(4)
  })

  it('is a no-op when both personnel strings absent', function () {
    const play = { foo: 'bar' }
    add_personnel_counts_to_play_data(play)
    expect(play).to.deep.equal({ foo: 'bar' })
  })

  it('does not overwrite the other side with NULL', function () {
    const play = {
      offense_personnel: '1 RB, 1 TE, 3 WR',
      defense_personnel_defensive_line_count: 4
    }
    add_personnel_counts_to_play_data(play)
    expect(play.defense_personnel_defensive_line_count).to.equal(4)
  })

  it('handles unparseable strings without throwing or overwriting', function () {
    const play = { offense_personnel: 'gibberish' }
    add_personnel_counts_to_play_data(play)
    expect(play).to.not.have.property('offense_personnel_running_back_count')
  })

  it('writes no counts for a vendor package name and leaves existing ones alone', function () {
    const play = {
      defense_personnel: 'Nickel',
      defense_personnel_defensive_line_count: 4,
      defense_personnel_linebacker_count: 2
    }
    add_personnel_counts_to_play_data(play)
    expect(play).to.not.have.property('defense_personnel_defensive_back_count')
    expect(play.defense_personnel_defensive_line_count).to.equal(4)
    expect(play.defense_personnel_linebacker_count).to.equal(2)
  })
})
