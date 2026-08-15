/* global describe it */

import * as chai from 'chai'

import { expand_position } from '#libs-server/find-player-row.mjs'
import {
  position_vocabulary,
  position_alias_map,
  normalize_position
} from '#libs-shared/constants/position-constants.mjs'

const expect = chai.expect

// Golden for expand_position. Its value is not that it stays green -- it is that
// its DIFF is the reviewable behavior change, line by line.
//
// There is deliberately NO regeneration script. A regenerable golden gets
// re-blessed by the buggy code it was meant to gate, which has happened three
// separate times in this repo. Every line below is hand-reviewed against the
// implementation.
//
// EXPECTED_EXPANSIONS states, for every position code that can reach
// find_player_row, the list of stored values a lookup for that code matches
// against primary/secondary/tertiary_position. The three assertions after the
// table catch what a table cannot: that the table covers the whole input
// vocabulary, that every value it returns is one a column can actually store,
// and that a code always matches players stored under its own canonical name.

const EXPECTED_EXPANSIONS = {
  // skill positions -- no tolerance, they are their own group
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  DST: ['DST'],

  // A fullback is routinely listed as a running back. One-way: RB does not
  // reach FB.
  FB: ['FB', 'RB'],

  // offensive line, including long snappers (frequently listed as C)
  OL: ['OL', 'T', 'G', 'C', 'LS'],
  T: ['OL', 'T', 'G', 'C', 'LS'],
  G: ['OL', 'T', 'G', 'C', 'LS'],
  C: ['OL', 'T', 'G', 'C', 'LS'],
  LS: ['OL', 'T', 'G', 'C', 'LS'],
  OT: ['OL', 'T', 'G', 'C', 'LS'],
  OG: ['OL', 'T', 'G', 'C', 'LS'],
  LT: ['OL', 'T', 'G', 'C', 'LS'],
  RT: ['OL', 'T', 'G', 'C', 'LS'],
  LG: ['OL', 'T', 'G', 'C', 'LS'],
  RG: ['OL', 'T', 'G', 'C', 'LS'],
  OC: ['OL', 'T', 'G', 'C', 'LS'],

  // defensive line. Reaches into LB because edge rushers are cross-classified.
  DL: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  DE: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  DT: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  NT: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  EDGE: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  ED: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  DI: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  DG: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  LDE: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  RDE: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  LDT: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],
  RDT: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB'],

  // linebacker. The mirror of the DL cross-reach above.
  LB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],
  OLB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],
  ILB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],
  MLB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],
  MIKE: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],
  WILL: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],
  LOLB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],
  ROLB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],
  LILB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],
  RILB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],
  $LB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'DE', 'DL'],

  // defensive back
  DB: ['DB', 'CB', 'S'],
  CB: ['DB', 'CB', 'S'],
  S: ['DB', 'CB', 'S'],
  SS: ['DB', 'CB', 'S'],
  FS: ['DB', 'CB', 'S'],
  SAF: ['DB', 'CB', 'S'],
  LCB: ['DB', 'CB', 'S'],
  RCB: ['DB', 'CB', 'S'],

  // specialists. K and P deliberately do NOT reach each other -- see the hazard
  // comment on POSITION_MATCH_TOLERANCE in find-player-row.mjs.
  K: ['K'],
  P: ['P'],
  KICKER: ['K'],
  PUNTER: ['P'],

  // backfield, including single-wing spellings
  HB: ['RB'],
  'H-B': ['RB'],
  TB: ['RB'],
  BB: ['RB'],
  WB: ['RB'],

  // receiver and end, including single-wing spellings
  OE: ['TE'],
  E: ['TE'],
  FL: ['WR'],

  // team defense
  DEF: ['DST']
}

describe('LIBS-SERVER expand_position', function () {
  describe('expansion table', function () {
    for (const [pos, expected] of Object.entries(EXPECTED_EXPANSIONS)) {
      it(`expands ${pos}`, function () {
        expect(expand_position(pos)).to.deep.equal(expected)
      })
    }

    it('is case insensitive', function () {
      expect(expand_position('cb')).to.deep.equal(EXPECTED_EXPANSIONS.CB)
    })
  })

  // An unmapped code self-expands and matches nothing, which is what callers
  // already handle. PFF's ALIGNMENT spellings depend on it: they report where a
  // player lined up rather than his roster position, and are folded at the
  // archive boundary in private/libs-server/pff-archive.mjs. Making this throw
  // is a real improvement with a much wider blast radius and is its own task.
  describe('unmapped codes', function () {
    it('self-expands a PFF alignment code rather than throwing', function () {
      expect(expand_position('LWR')).to.deep.equal(['LWR'])
      expect(expand_position('SRWR')).to.deep.equal(['SRWR'])
      expect(expand_position('DRT')).to.deep.equal(['DRT'])
    })

    it('drops an absent position rather than matching on empty string', function () {
      expect(expand_position('')).to.deep.equal([])
      expect(expand_position(null)).to.deep.equal([])
      expect(expand_position(undefined)).to.deep.equal([])
    })
  })

  // The ratchet. A new alias added to position_alias_map without a stated
  // expansion fails here, which is what stops a fourth position vocabulary
  // accreting the way expand_position's own normalizer did.
  describe('key-set completeness', function () {
    it('states an expansion for every position code in the vocabulary', function () {
      const expected_keys = [
        ...new Set([...position_vocabulary, ...Object.keys(position_alias_map)])
      ].sort()

      expect(Object.keys(EXPECTED_EXPANSIONS).sort()).to.deep.equal(
        expected_keys
      )
    })
  })

  // Canonical closure. An expansion is matched against three columns that each
  // carry a CHECK constraint on position_vocabulary, so any value outside it is
  // dead weight in the whereIn.
  describe('canonical closure', function () {
    it('returns only values a position column can store', function () {
      const storable = new Set(position_vocabulary)
      const unstorable = new Set()

      for (const expansion of Object.values(EXPECTED_EXPANSIONS)) {
        for (const value of expansion) {
          if (!storable.has(value)) unstorable.add(value)
        }
      }

      expect([...unstorable]).to.deep.equal([])
    })
  })

  // Self-match. A lookup for a code must at minimum find players stored under
  // the canonical position that code names, or it cannot resolve anyone. This
  // is what the 27 self-expanding aliases used to fail.
  describe('self-match', function () {
    it("contains each code's own canonical position", function () {
      const missing = []

      for (const [pos, expansion] of Object.entries(EXPECTED_EXPANSIONS)) {
        if (!expansion.includes(normalize_position(pos))) missing.push(pos)
      }

      expect(missing).to.deep.equal([])
    })
  })
})
