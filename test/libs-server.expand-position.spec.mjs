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
  WR: ['WR'],
  TE: ['TE'],
  DST: ['DST'],

  // backfield. FB reaches RB but RB does not reach FB: a lookup for a fullback
  // should find him listed as a running back, while an RB lookup that also
  // matched fullbacks would widen every RB lookup in the codebase.
  RB: ['RB', 'HB'],
  FB: ['FB', 'RB'],
  HB: ['RB', 'HB'],
  'H-B': ['H-B'],
  TB: ['TB'],
  BB: ['BB'],
  WB: ['WB'],

  // offensive line, including long snappers (frequently listed as C)
  OL: ['OL', 'OG', 'OT', 'C', 'G', 'T', 'LS'],
  T: ['OL', 'OG', 'OT', 'C', 'G', 'T', 'LS'],
  G: ['OL', 'OG', 'OT', 'C', 'G', 'T', 'LS'],
  C: ['OL', 'OG', 'OT', 'C', 'G', 'T', 'LS'],
  LS: ['OL', 'OG', 'OT', 'C', 'G', 'T', 'LS'],
  OT: ['OL', 'OG', 'OT', 'C', 'G', 'T', 'LS'],
  OG: ['OL', 'OG', 'OT', 'C', 'G', 'T', 'LS'],
  LT: ['LT'],
  RT: ['RT'],
  LG: ['LG'],
  RG: ['RG'],
  OC: ['OC'],

  // defensive line. Reaches into LB because edge rushers are cross-classified.
  DL: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'ED', 'DI', 'LB', 'OLB'],
  DE: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'ED', 'DI', 'LB', 'OLB'],
  DT: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'ED', 'DI', 'LB', 'OLB'],
  NT: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'ED', 'DI', 'LB', 'OLB'],
  EDGE: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'ED', 'DI', 'LB', 'OLB'],
  ED: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'ED', 'DI', 'LB', 'OLB'],
  DI: ['DL', 'DE', 'DT', 'NT', 'EDGE', 'ED', 'DI', 'LB', 'OLB'],
  LDE: ['LDE'],
  RDE: ['RDE'],
  DG: ['DG'],
  LDT: ['LDT'],
  RDT: ['RDT'],

  // linebacker. The mirror of the DL cross-reach above.
  LB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'ED', 'DI', 'DE', 'DL'],
  OLB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'ED', 'DI', 'DE', 'DL'],
  ILB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'ED', 'DI', 'DE', 'DL'],
  MLB: ['LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'ED', 'DI', 'DE', 'DL'],
  MIKE: ['MIKE'],
  WILL: ['WILL'],
  LOLB: ['LOLB'],
  ROLB: ['ROLB'],
  LILB: ['LILB'],
  RILB: ['RILB'],
  $LB: ['$LB'],

  // defensive back
  DB: ['DB', 'CB', 'S', 'SAF', 'FS', 'SS'],
  CB: ['DB', 'CB', 'S', 'SAF', 'FS', 'SS'],
  S: ['DB', 'CB', 'S', 'SAF', 'FS', 'SS'],
  SS: ['DB', 'CB', 'S', 'SAF', 'FS', 'SS'],
  FS: ['DB', 'CB', 'S', 'SAF', 'FS', 'SS'],
  SAF: ['DB', 'CB', 'S', 'SAF', 'FS', 'SS'],
  LCB: ['LCB'],
  RCB: ['RCB'],

  // specialists. K and P deliberately do NOT reach each other -- see the hazard
  // comment in find-player-row.mjs.
  K: ['K'],
  P: ['P'],
  KICKER: ['K'],
  PUNTER: ['P'],

  // receiver and end, including single-wing spellings
  OE: ['OE'],
  E: ['E'],
  FL: ['FL'],

  // team defense
  DEF: ['DEF']
}

// Spellings the table states that position_alias_map does not carry. These are
// FantasyPoints' full-word specialist codes, folded by expand_position's own
// normalizer rather than by normalize_position -- which is the duplication this
// golden exists to gate.
const SPELLINGS_ABSENT_FROM_THE_ALIAS_MAP = ['PUNTER', 'KICKER']

// Aliases whose expansion does not contain the canonical position they name.
// Each one matches NOTHING: expand_position hands back the alias itself, and no
// position column stores an alias. This is the defect, enumerated.
const ALIASES_THAT_MATCH_NOTHING = [
  'LT',
  'RT',
  'LG',
  'RG',
  'OC',
  'LDE',
  'RDE',
  'DG',
  'LDT',
  'RDT',
  'MIKE',
  'WILL',
  'LOLB',
  'ROLB',
  'LILB',
  'RILB',
  '$LB',
  'LCB',
  'RCB',
  'H-B',
  'TB',
  'BB',
  'WB',
  'OE',
  'E',
  'FL',
  'DEF'
]

// Values that appear in an expansion but are not legal stored values. All three
// position columns on player carry a CHECK constraint on position_vocabulary,
// so a whereIn against these can never match a row.
const UNSTORABLE_VALUES_IN_EXPANSIONS = [
  'OG',
  'OT',
  'ED',
  'DI',
  'SAF',
  'FS',
  'SS',
  'HB'
]

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

  // The ratchet. A new alias added to position_alias_map without a stated
  // expansion fails here, which is what stops a fourth position vocabulary
  // accreting the way expand_position's own normalizer did.
  describe('key-set completeness', function () {
    it('states an expansion for every position code in the vocabulary', function () {
      const expected_keys = [
        ...new Set([
          ...position_vocabulary,
          ...Object.keys(position_alias_map),
          ...SPELLINGS_ABSENT_FROM_THE_ALIAS_MAP
        ])
      ].sort()

      expect(Object.keys(EXPECTED_EXPANSIONS).sort()).to.deep.equal(
        expected_keys
      )
    })

    it('states which spellings normalize_position does not know', function () {
      const unknown = Object.keys(EXPECTED_EXPANSIONS).filter((pos) => {
        try {
          normalize_position(pos)
          return false
        } catch {
          return true
        }
      })

      expect(unknown.sort()).to.deep.equal(
        [...SPELLINGS_ABSENT_FROM_THE_ALIAS_MAP].sort()
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

      expect([...unstorable].sort()).to.deep.equal(
        [
          ...UNSTORABLE_VALUES_IN_EXPANSIONS,
          ...ALIASES_THAT_MATCH_NOTHING
        ].sort()
      )
    })
  })

  // Self-match. A lookup for a code must at minimum find players stored under
  // the canonical position that code names, or it cannot resolve anyone.
  describe('self-match', function () {
    it("contains each code's own canonical position", function () {
      const missing = []

      for (const [pos, expansion] of Object.entries(EXPECTED_EXPANSIONS)) {
        if (SPELLINGS_ABSENT_FROM_THE_ALIAS_MAP.includes(pos)) continue
        if (!expansion.includes(normalize_position(pos))) missing.push(pos)
      }

      expect(missing.sort()).to.deep.equal(
        [...ALIASES_THAT_MATCH_NOTHING].sort()
      )
    })
  })
})
