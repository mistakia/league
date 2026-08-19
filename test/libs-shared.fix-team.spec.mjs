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

  describe('historical PFR draft-page codes', function () {
    it('maps PHO (Phoenix Cardinals) to the Cardinals canonical', () => {
      expect(fixTeam('PHO')).to.equal('ARI')
      expect(fixTeam('pho')).to.equal('ARI')
      expect(fixTeam('PHOENIX CARDINALS')).to.equal('ARI')
      expect(fixTeam('PHOENIX')).to.equal('ARI')
    })

    it('maps RAI (LA Raiders) to the Raiders canonical', () => {
      expect(fixTeam('RAI')).to.equal('LV')
      expect(fixTeam('rai')).to.equal('LV')
      expect(fixTeam('LOS ANGELES RAIDERS')).to.equal('LV')
      expect(fixTeam('LA RAIDERS')).to.equal('LV')
    })
  })

  it('rejects CRD, the PFR franchise slug no 1990-2026 draft page uses', () => {
    // Source-grounded negative control: `crd` is PFR's internal franchise
    // identifier for the Cardinals (see active_nfl_teams in
    // private/libs-server/pro-football-reference.mjs), which reads as a
    // plausible draft-page code but never appears on one -- the pages use PHO
    // (1990-93) then ARI (1994+). Only codes actually present on the source
    // pages belong in the mapping.
    expect(() => fixTeam('CRD')).to.throw('Invalid team: CRD')
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
