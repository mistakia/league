/* global describe it */
import * as chai from 'chai'

import {
  position_groups,
  position_group_members,
  position_vocabulary,
  group_for_position,
  position_alias_map,
  normalize_position,
  get_position_group
} from '#libs-shared/constants/position-constants.mjs'

const expect = chai.expect

describe('LIBS-SHARED position-constants', function () {
  describe('vocabulary', function () {
    it('holds 25 values with no duplicates', () => {
      expect(position_vocabulary.length).to.equal(25)
      expect(new Set(position_vocabulary).size).to.equal(25)
    })

    it('contains every group and every detail member', () => {
      for (const group of position_groups) {
        expect(position_vocabulary).to.include(group)
        for (const member of position_group_members[group]) {
          expect(position_vocabulary).to.include(member)
        }
      }
    })
  })

  describe('group_for_position', function () {
    // Totality is the property that makes a GROUP BY on this map complete. A
    // vocabulary member with no group would silently drop its rows.
    it('is total over the vocabulary', () => {
      for (const position of position_vocabulary) {
        expect(group_for_position[position], position).to.be.a('string')
      }
    })

    it('maps every group to itself', () => {
      for (const group of position_groups) {
        expect(group_for_position[group]).to.equal(group)
      }
    })

    it('maps only to groups', () => {
      for (const group of Object.values(group_for_position)) {
        expect(position_groups).to.include(group)
      }
    })

    it('has no key outside the vocabulary', () => {
      for (const position of Object.keys(group_for_position)) {
        expect(position_vocabulary).to.include(position)
      }
    })
  })

  describe('position_alias_map', function () {
    it('resolves every alias to a vocabulary member', () => {
      for (const [alias, target] of Object.entries(position_alias_map)) {
        expect(position_vocabulary, alias).to.include(target)
      }
    })

    // An alias that is also a legal stored value would make normalization
    // depend on lookup order rather than on the vocabulary.
    it('has no alias shadowing a vocabulary member', () => {
      for (const alias of Object.keys(position_alias_map)) {
        expect(position_vocabulary, alias).to.not.include(alias)
      }
    })

    it('resolves every alias in a single hop', () => {
      for (const target of Object.values(position_alias_map)) {
        expect(position_alias_map[target], target).to.equal(undefined)
      }
    })
  })

  describe('normalize_position', function () {
    it('returns null for absent values', () => {
      expect(normalize_position(null)).to.equal(null)
      expect(normalize_position(undefined)).to.equal(null)
      expect(normalize_position('')).to.equal(null)
      expect(normalize_position('   ')).to.equal(null)
    })

    it('passes vocabulary members through unchanged', () => {
      for (const position of position_vocabulary) {
        expect(normalize_position(position)).to.equal(position)
      }
    })

    it('resolves aliases', () => {
      expect(normalize_position('OT')).to.equal('T')
      expect(normalize_position('OG')).to.equal('G')
      expect(normalize_position('SAF')).to.equal('S')
      expect(normalize_position('HB')).to.equal('RB')
      expect(normalize_position('DEF')).to.equal('DST')
      expect(normalize_position('$LB')).to.equal('LB')
    })

    // EDGE is a canonical DL member. This reverses the retired
    // format-position.mjs, which folded EDGE into DE.
    it('maps ED to EDGE rather than DE', () => {
      expect(normalize_position('ED')).to.equal('EDGE')
      expect(normalize_position('EDGE')).to.equal('EDGE')
    })

    it('maps single-wing era spellings to modern equivalents', () => {
      expect(normalize_position('TB')).to.equal('RB')
      expect(normalize_position('BB')).to.equal('RB')
      expect(normalize_position('WB')).to.equal('RB')
      expect(normalize_position('E')).to.equal('TE')
      expect(normalize_position('FL')).to.equal('WR')
    })

    // player_prospect_profile stores its entire vocabulary lowercase.
    it('upper-cases and trims before lookup', () => {
      expect(normalize_position('cb')).to.equal('CB')
      expect(normalize_position('ed')).to.equal('EDGE')
      expect(normalize_position('will')).to.equal('OLB')
      expect(normalize_position('  wr  ')).to.equal('WR')
    })

    it('throws on an unmapped value', () => {
      // The junk carried by production columns, all dispositioned by backfill
      // rather than by alias.
      for (const junk of ['UNK', 'O', 'KR', 'PR', 'KOR', 'SPEC', 'ST', 'INA']) {
        expect(() => normalize_position(junk), junk).to.throw(
          /unmapped position value/
        )
      }
    })

    it('throws on a compound value rather than truncating it', () => {
      expect(() => normalize_position('WR/RB')).to.throw(
        /unmapped position value/
      )
    })
  })

  describe('get_position_group', function () {
    it('returns null for absent values', () => {
      expect(get_position_group(null)).to.equal(null)
      expect(get_position_group('')).to.equal(null)
    })

    it('groups detail members', () => {
      expect(get_position_group('EDGE')).to.equal('DL')
      expect(get_position_group('CB')).to.equal('DB')
      expect(get_position_group('FB')).to.equal('RB')
      expect(get_position_group('C')).to.equal('OL')
      expect(get_position_group('MLB')).to.equal('LB')
    })

    it('groups raw aliases through normalization', () => {
      expect(get_position_group('SS')).to.equal('DB')
      expect(get_position_group('ot')).to.equal('OL')
      expect(get_position_group('DI')).to.equal('DL')
    })

    it('returns groups unchanged', () => {
      for (const group of position_groups) {
        expect(get_position_group(group)).to.equal(group)
      }
    })

    // SPEC decomposes into P, K and LS, which have no shared group. The
    // nfl_plays_player.position_group column is re-derived from
    // player_position rather than conformed, so no SPEC handling exists here.
    it('does not resolve SPEC', () => {
      expect(() => get_position_group('SPEC')).to.throw(
        /unmapped position value/
      )
    })
  })
})
