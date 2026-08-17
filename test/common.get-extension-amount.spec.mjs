/* global describe it */

import * as chai from 'chai'

import { getExtensionAmount } from '#libs-shared'
import { player_tag_types, roster_slot_types } from '#constants'

process.env.NODE_ENV = 'test'

const { expect } = chai

// `getExtensionAmount` is the single place a rostered player's cap charge is priced,
// and every consumer of it -- the roster class, the add-player gate, waivers, poaches,
// the league-team salary totals -- inherits whatever it decides. It had no test of any
// kind, which is how the restricted free agency branch came to turn on the difference
// between an ABSENT bid and a $0 bid without anything pinning that difference down.
//
// The distinction is the whole point of the branch: `bid ?? value` prices a committed
// $0 bid at $0 and an unbid player at their prior salary. Under the `||` this replaced,
// both priced at the prior salary, which silently discarded a real $0 bid. Getting it
// wrong in the other direction -- defaulting an absent bid to 0 before the call, which
// two components did -- hands the team a free roster spot instead.

const league = {
  franchise_tag_salary_quarterback: 20,
  franchise_tag_salary_running_back: 15,
  franchise_tag_salary_wide_receiver: 18,
  franchise_tag_salary_tight_end: 10
}

describe('LIBS-SHARED getExtensionAmount', function () {
  describe('restricted free agency tag', function () {
    const restricted = (bid) =>
      getExtensionAmount({
        tag: player_tag_types.RESTRICTED_FREE_AGENCY,
        pos: 'WR',
        league,
        player_salary: 6,
        extensions: 0,
        bid
      })

    it('prices a committed $0 bid at $0, not at the prior salary', () => {
      expect(restricted(0)).to.equal(0)
    })

    it('prices a non-zero bid at the bid', () => {
      expect(restricted(23)).to.equal(23)
    })

    it('falls back to the prior salary when no bid exists', () => {
      expect(restricted(undefined)).to.equal(6)
    })

    it('treats a null bid as no bid rather than as $0', () => {
      // Reducers clear this field to an explicit null, and Immutable's
      // `get(key, default)` does not substitute for a present null.
      expect(restricted(null)).to.equal(6)
    })

    it('does not apply the regular extension ladder', () => {
      expect(restricted(23)).to.not.equal(6 + 1 * 5)
    })
  })

  describe('practice squad slots short-circuit before the tag', function () {
    const practice_squad_slots = [
      roster_slot_types.PS,
      roster_slot_types.PSP,
      roster_slot_types.PSD,
      roster_slot_types.PSDP
    ]

    for (const slot of practice_squad_slots) {
      it(`returns the prior salary for slot ${slot} even with a bid`, () => {
        expect(
          getExtensionAmount({
            slot,
            tag: player_tag_types.RESTRICTED_FREE_AGENCY,
            pos: 'WR',
            league,
            player_salary: 4,
            extensions: 2,
            bid: 30
          })
        ).to.equal(4)
      })
    }

    it('does not short-circuit for a bench slot', () => {
      expect(
        getExtensionAmount({
          slot: roster_slot_types.BENCH,
          tag: player_tag_types.RESTRICTED_FREE_AGENCY,
          pos: 'WR',
          league,
          player_salary: 4,
          extensions: 2,
          bid: 30
        })
      ).to.equal(30)
    })
  })

  describe('franchise tag', function () {
    const franchise = (pos) =>
      getExtensionAmount({
        tag: player_tag_types.FRANCHISE,
        pos,
        league,
        player_salary: 9,
        extensions: 3
      })

    it('prices from the league franchise tag amount for the position', () => {
      expect(franchise('QB')).to.equal(20)
      expect(franchise('RB')).to.equal(15)
      expect(franchise('WR')).to.equal(18)
      expect(franchise('TE')).to.equal(10)
    })

    it('prices an unfranchisable position at $0 rather than undefined', () => {
      expect(franchise('K')).to.equal(0)
    })

    it('prices at $0 when the league has no amount configured', () => {
      expect(
        getExtensionAmount({
          tag: player_tag_types.FRANCHISE,
          pos: 'QB',
          league: {},
          player_salary: 9,
          extensions: 3
        })
      ).to.equal(0)
    })
  })

  describe('rookie tag', function () {
    it('holds the prior salary regardless of extension count', () => {
      expect(
        getExtensionAmount({
          tag: player_tag_types.ROOKIE,
          pos: 'RB',
          league,
          player_salary: 7,
          extensions: 4
        })
      ).to.equal(7)
    })
  })

  describe('regular tag', function () {
    const regular = (extensions) =>
      getExtensionAmount({
        tag: player_tag_types.REGULAR,
        pos: 'RB',
        league,
        player_salary: 7,
        extensions
      })

    it('adds $5 for the first extension', () => {
      expect(regular(0)).to.equal(12)
    })

    it('climbs $5 per extension already taken', () => {
      expect(regular(1)).to.equal(17)
      expect(regular(2)).to.equal(22)
    })

    it('applies the same ladder to an unrecognised tag', () => {
      expect(
        getExtensionAmount({
          tag: undefined,
          pos: 'RB',
          league,
          player_salary: 7,
          extensions: 1
        })
      ).to.equal(17)
    })

    it('ignores a bid, which belongs only to the restricted branch', () => {
      expect(
        getExtensionAmount({
          tag: player_tag_types.REGULAR,
          pos: 'RB',
          league,
          player_salary: 7,
          extensions: 0,
          bid: 40
        })
      ).to.equal(12)
    })
  })
})
