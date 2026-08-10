/* global describe it */

import * as chai from 'chai'

import { fixTeam } from '#libs-shared'

chai.should()
const expect = chai.expect

describe('LIBS-SHARED fixTeam', function () {
  describe('Arizona Cardinals', function () {
    it('accepts AZ (the NGS schedule feed abbreviation)', () => {
      expect(fixTeam('AZ')).to.equal('ARI')
      expect(fixTeam('az')).to.equal('ARI')
    })

    it('keeps the other Arizona aliases', () => {
      for (const alias of [
        'ARI',
        'ARZ',
        'CARDINALS',
        'ARIZONA CARDINALS',
        'ARI CARDINALS'
      ]) {
        expect(fixTeam(alias)).to.equal('ARI')
      }
    })
  })

  it('maps every canonical abbreviation to itself', () => {
    const canonical = [
      'ARI',
      'ATL',
      'BAL',
      'BUF',
      'CAR',
      'CHI',
      'CIN',
      'CLE',
      'DAL',
      'DEN',
      'DET',
      'GB',
      'HOU',
      'IND',
      'JAX',
      'KC',
      'LAC',
      'LA',
      'LV',
      'MIA',
      'MIN',
      'NE',
      'NO',
      'NYG',
      'NYJ',
      'PHI',
      'PIT',
      'SF',
      'SEA',
      'TB',
      'TEN',
      'WAS'
    ]
    for (const abbr of canonical) {
      expect(fixTeam(abbr), abbr).to.equal(abbr)
    }
  })

  it('throws on an unknown team', () => {
    expect(() => fixTeam('XYZ')).to.throw('Invalid team: XYZ')
  })
})
