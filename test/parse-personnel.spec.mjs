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
        side: 'off'
      })
      expect(result).to.deep.equal({ qb: 1, rb: 1, te: 1, wr: 3, ol: 5 })
    })

    it('parses long format with non-default QB and OL', function () {
      const result = parse_personnel_string({
        value: '6 OL, 2 QB, 1 RB, 0 TE, 2 WR',
        side: 'off'
      })
      expect(result).to.deep.equal({ qb: 2, rb: 1, te: 0, wr: 2, ol: 6 })
    })

    it('parses short-code format', function () {
      expect(
        parse_personnel_string({ value: '11', side: 'off' })
      ).to.deep.equal({ qb: 1, rb: 1, te: 1, wr: 3, ol: 5 })
      expect(
        parse_personnel_string({ value: '12', side: 'off' })
      ).to.deep.equal({ qb: 1, rb: 1, te: 2, wr: 2, ol: 5 })
    })

    it('parses short-code with asterisk variant', function () {
      expect(
        parse_personnel_string({ value: '01*', side: 'off' })
      ).to.deep.equal({ qb: 1, rb: 0, te: 1, wr: 4, ol: 5 })
    })

    it('rejects short-code that overflows wr', function () {
      expect(
        parse_personnel_string({ value: '99', side: 'off' })
      ).to.equal(null)
    })

    it('applies QB and OL defaults when absent', function () {
      expect(
        parse_personnel_string({ value: '2 RB, 2 TE, 1 WR', side: 'off' })
      ).to.deep.equal({ qb: 1, rb: 2, te: 2, wr: 1, ol: 5 })
    })
  })

  describe('defense', function () {
    it('parses long format', function () {
      expect(
        parse_personnel_string({ value: '4 DL, 3 LB, 4 DB', side: 'def' })
      ).to.deep.equal({ dl: 4, lb: 3, db: 4 })
    })

    it('soft-maps Nickel', function () {
      expect(
        parse_personnel_string({ value: 'Nickel', side: 'def' })
      ).to.deep.equal({ db:5 })
    })

    it('soft-maps Dime', function () {
      expect(
        parse_personnel_string({ value: 'Dime', side: 'def' })
      ).to.deep.equal({ db:6 })
    })

    it('soft-maps Base', function () {
      expect(
        parse_personnel_string({ value: 'Base', side: 'def' })
      ).to.deep.equal({ db:4 })
    })

    it('soft-maps 0-3DB', function () {
      expect(
        parse_personnel_string({ value: '0-3DB', side: 'def' })
      ).to.deep.equal({ db:3 })
    })

    it('soft-maps 7+DB', function () {
      expect(
        parse_personnel_string({ value: '7+DB', side: 'def' })
      ).to.deep.equal({ db:7 })
    })
  })

  describe('null handling', function () {
    it('returns null for null input', function () {
      expect(parse_personnel_string({ value: null, side: 'off' })).to.equal(
        null
      )
    })

    it('returns null for undefined input', function () {
      expect(
        parse_personnel_string({ value: undefined, side: 'off' })
      ).to.equal(null)
    })

    it('returns null for empty string', function () {
      expect(parse_personnel_string({ value: '', side: 'off' })).to.equal(null)
    })

    it('returns null for unparseable defensive labels', function () {
      expect(parse_personnel_string({ value: 'Other', side: 'def' })).to.equal(
        null
      )
    })

    it('throws on invalid side', function () {
      expect(() =>
        parse_personnel_string({ value: '1 RB', side: 'special' })
      ).to.throw()
    })
  })
})

describe('add_personnel_counts_to_play_data', function () {
  it('mutates a play row with offensive counts only when only off_personnel present', function () {
    const play = { off_personnel: '1 RB, 1 TE, 3 WR' }
    add_personnel_counts_to_play_data(play)
    expect(play.off_personnel_rb_count).to.equal(1)
    expect(play.off_personnel_te_count).to.equal(1)
    expect(play.off_personnel_wr_count).to.equal(3)
    expect(play.off_personnel_qb_count).to.equal(1)
    expect(play.off_personnel_ol_count).to.equal(5)
    expect(play).to.not.have.property('def_personnel_dl_count')
  })

  it('populates both sides when both strings present', function () {
    const play = {
      off_personnel: '1 RB, 1 TE, 3 WR',
      def_personnel: '4 DL, 3 LB, 4 DB'
    }
    add_personnel_counts_to_play_data(play)
    expect(play.def_personnel_dl_count).to.equal(4)
    expect(play.def_personnel_lb_count).to.equal(3)
    expect(play.def_personnel_db_count).to.equal(4)
  })

  it('is a no-op when both personnel strings absent', function () {
    const play = { foo: 'bar' }
    add_personnel_counts_to_play_data(play)
    expect(play).to.deep.equal({ foo: 'bar' })
  })

  it('does not overwrite the other side with NULL', function () {
    const play = {
      off_personnel: '1 RB, 1 TE, 3 WR',
      def_personnel_dl_count: 4
    }
    add_personnel_counts_to_play_data(play)
    expect(play.def_personnel_dl_count).to.equal(4)
  })

  it('handles unparseable strings without throwing or overwriting', function () {
    const play = { off_personnel: 'gibberish' }
    add_personnel_counts_to_play_data(play)
    expect(play).to.not.have.property('off_personnel_rb_count')
  })

  it('does not overwrite dl/lb when defensive softmap label parses to db only', function () {
    const play = {
      def_personnel: 'Nickel',
      def_personnel_dl_count: 4,
      def_personnel_lb_count: 2
    }
    add_personnel_counts_to_play_data(play)
    expect(play.def_personnel_db_count).to.equal(5)
    expect(play.def_personnel_dl_count).to.equal(4)
    expect(play.def_personnel_lb_count).to.equal(2)
  })
})
