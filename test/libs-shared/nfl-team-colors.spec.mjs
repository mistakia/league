/* global describe it */

import * as chai from 'chai'

import {
  nfl_team_colors,
  get_team_color
} from '#libs-shared/nfl-team-colors.mjs'

const expect = chai.expect

describe('LIBS-SHARED nfl-team-colors', function () {
  describe('nfl_team_colors', function () {
    it('should export an object', function () {
      expect(nfl_team_colors).to.be.an('object')
    })

    it('should contain 32 teams', function () {
      expect(Object.keys(nfl_team_colors)).to.have.length(32)
    })

    it('should return correct primary color for KC', function () {
      expect(nfl_team_colors.KC.primary).to.equal('#e31837')
    })

    it('should return correct secondary color for GB', function () {
      expect(nfl_team_colors.GB.secondary).to.equal('#ffb612')
    })

    it('should return correct text color for PIT', function () {
      expect(nfl_team_colors.PIT.text).to.equal('#000000')
    })

    it('each team entry should have primary, secondary, and text keys', function () {
      for (const [abbr, colors] of Object.entries(nfl_team_colors)) {
        expect(colors, `${abbr} missing primary`).to.have.property('primary')
        expect(colors, `${abbr} missing secondary`).to.have.property(
          'secondary'
        )
        expect(colors, `${abbr} missing text`).to.have.property('text')
      }
    })

    it('each color value should be a valid hex string', function () {
      const hex_re = /^#[0-9a-f]{6}$/i
      for (const [abbr, colors] of Object.entries(nfl_team_colors)) {
        expect(colors.primary, `${abbr}.primary invalid`).to.match(hex_re)
        expect(colors.secondary, `${abbr}.secondary invalid`).to.match(hex_re)
        expect(colors.text, `${abbr}.text invalid`).to.match(hex_re)
      }
    })
  })

  describe('get_team_color', function () {
    it('should return primary color by default', function () {
      expect(get_team_color({ abbr: 'NE' })).to.equal(nfl_team_colors.NE.primary)
    })

    it('should return primary color when key is primary', function () {
      expect(get_team_color({ abbr: 'DAL', key: 'primary' })).to.equal(
        nfl_team_colors.DAL.primary
      )
    })

    it('should return secondary color when key is secondary', function () {
      expect(get_team_color({ abbr: 'SF', key: 'secondary' })).to.equal(
        nfl_team_colors.SF.secondary
      )
    })

    it('should return text color when key is text', function () {
      expect(get_team_color({ abbr: 'NO', key: 'text' })).to.equal(
        nfl_team_colors.NO.text
      )
    })

    it('should return default color for unknown abbreviation', function () {
      expect(get_team_color({ abbr: 'XYZ' })).to.equal('#666666')
    })

    it('should return default color for undefined abbreviation', function () {
      expect(get_team_color({ abbr: undefined })).to.equal('#666666')
    })

    it('should return default color when called with no arguments', function () {
      expect(get_team_color()).to.equal('#666666')
    })

    it('should return default color for null abbreviation', function () {
      expect(get_team_color({ abbr: null })).to.equal('#666666')
    })

    it('should return correct color for LA (Rams)', function () {
      expect(get_team_color({ abbr: 'LA', key: 'primary' })).to.equal(
        '#003594'
      )
    })
  })
})
