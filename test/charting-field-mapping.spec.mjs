/* global describe it */

import * as chai from 'chai'

import {
  map_charting_play_to_db_fields,
  parse_clock_to_seconds,
  convert_field_position_to_ydl_100,
  map_qb_alignment,
  normalize_coverage_type
} from '#libs-server/charting-data/field-mapping.mjs'

chai.should()
const expect = chai.expect

describe('LIBS-SERVER charting-data field-mapping', function () {
  describe('parse_clock_to_seconds', function () {
    it('parses HH:MM:SS format', () => {
      expect(parse_clock_to_seconds('0:12:30')).to.equal(750)
    })

    it('parses MM:SS format', () => {
      expect(parse_clock_to_seconds('12:30')).to.equal(750)
    })

    it('returns null for null input', () => {
      expect(parse_clock_to_seconds(null)).to.equal(null)
    })

    it('returns null for empty string', () => {
      expect(parse_clock_to_seconds('')).to.equal(null)
    })

    it('parses zero time', () => {
      expect(parse_clock_to_seconds('0:00:00')).to.equal(0)
    })
  })

  describe('convert_field_position_to_ydl_100', function () {
    it('converts own territory (negative) to ydl_100', () => {
      // -25 means own 25 yard line = 75 yards to opponent end zone
      expect(convert_field_position_to_ydl_100(-25)).to.equal(75)
    })

    it('converts opponent territory (positive) to ydl_100', () => {
      // +25 means opponent 25 = 25 yards to opponent end zone
      expect(convert_field_position_to_ydl_100(25)).to.equal(25)
    })

    it('converts midfield (0) to ydl_100', () => {
      expect(convert_field_position_to_ydl_100(0)).to.equal(50)
    })

    it('converts own goal line (-50) to ydl_100', () => {
      // Own 50 = midfield from own side = 50 yards to opponent end zone
      expect(convert_field_position_to_ydl_100(-50)).to.equal(50)
    })

    it('converts opponent goal line (+50) to ydl_100', () => {
      // Opponent 50 = midfield from opponent side = 50 yards to their end zone
      expect(convert_field_position_to_ydl_100(50)).to.equal(50)
    })

    it('returns null for null input', () => {
      expect(convert_field_position_to_ydl_100(null)).to.equal(null)
    })
  })

  describe('map_qb_alignment', function () {
    it('maps SHOTGUN', () => {
      expect(map_qb_alignment('SHOTGUN')).to.equal('SHOTGUN')
    })

    it('maps UNDER CENTER', () => {
      expect(map_qb_alignment('UNDER CENTER')).to.equal('UNDER_CENTER')
    })

    it('maps PISTOL', () => {
      expect(map_qb_alignment('PISTOL')).to.equal('PISTOL')
    })

    it('returns null for null input', () => {
      expect(map_qb_alignment(null)).to.equal(null)
    })

    it('handles case insensitivity', () => {
      expect(map_qb_alignment('shotgun')).to.equal('SHOTGUN')
    })
  })

  describe('normalize_coverage_type', function () {
    it('normalizes spaces to underscores', () => {
      expect(normalize_coverage_type('COVER 3')).to.equal('COVER_3')
      expect(normalize_coverage_type('COVER 2 MAN')).to.equal('COVER_2_MAN')
    })

    it('handles already-normalized values', () => {
      expect(normalize_coverage_type('COVER_3')).to.equal('COVER_3')
      expect(normalize_coverage_type('COVER_0')).to.equal('COVER_0')
    })

    it('handles case insensitivity', () => {
      expect(normalize_coverage_type('cover 1')).to.equal('COVER_1')
    })

    it('returns null for unknown coverage types', () => {
      expect(normalize_coverage_type('UNKNOWN_COVERAGE')).to.equal(null)
    })

    it('returns null for null input', () => {
      expect(normalize_coverage_type(null)).to.equal(null)
    })

    it('normalizes all valid enum values', () => {
      expect(normalize_coverage_type('COVER 0')).to.equal('COVER_0')
      expect(normalize_coverage_type('COVER 1')).to.equal('COVER_1')
      expect(normalize_coverage_type('COVER 2')).to.equal('COVER_2')
      expect(normalize_coverage_type('COVER 4')).to.equal('COVER_4')
      expect(normalize_coverage_type('COVER 5')).to.equal('COVER_5')
      expect(normalize_coverage_type('COVER 6')).to.equal('COVER_6')
      expect(normalize_coverage_type('COVER 9')).to.equal('COVER_9')
      expect(normalize_coverage_type('COMBINATION')).to.equal('COMBINATION')
    })
  })

  describe('map_charting_play_to_db_fields', function () {
    it('maps a pass play with direct mappings', () => {
      const source = {
        quarter: 2,
        down: 3,
        distance: 7,
        isPassAttempt: true,
        rushAttempt: false,
        passingYards: 15,
        isCompletePass: true,
        isTouchdown: false,
        isPenalty: false,
        pressure: false,
        blitz: true,
        timeToThrow: 2.8,
        depthOfTarget: 12
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.qtr).to.equal(2)
      expect(result.dwn).to.equal(3)
      expect(result.yards_to_go).to.equal(7)
      expect(result.pass).to.equal(true)
      expect(result.rush).to.equal(false)
      expect(result.pass_yds).to.equal(15)
      expect(result.comp).to.equal(true)
      expect(result.td).to.equal(false)
      expect(result.penalty).to.equal(false)
      expect(result.qb_pressure).to.equal(false)
      expect(result.blitz).to.equal(true)
      expect(result.time_to_throw).to.equal(2.8)
      expect(result.dot).to.equal(12)
    })

    it('maps a rush play', () => {
      const source = {
        quarter: 1,
        down: 1,
        distance: 10,
        rushAttempt: true,
        rushYards: 5,
        runConcept: 'OUTSIDE_ZONE',
        runGapIntent: 'C_GAP',
        runGapIntentSide: 'LEFT',
        splitRun: false,
        reverseRun: false,
        leadRun: true
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.rush).to.equal(true)
      expect(result.rush_yds).to.equal(5)
      expect(result.run_concept).to.equal('OUTSIDE_ZONE')
      expect(result.run_gap_intent).to.equal('C_GAP')
      expect(result.run_gap_intent_side).to.equal('LEFT')
      expect(result.split_run).to.equal(false)
      expect(result.reverse_run).to.equal(false)
      expect(result.lead_run).to.equal(true)
    })

    it('maps scoring play fields', () => {
      const source = {
        fieldGoalMade: true,
        extraPointMade: false,
        twoPointMade: null,
        homeScoreAtStartOfPlay: 14,
        awayScoreAtStartOfPlay: 7
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.fg_result).to.equal('made')
      expect(result.ep_result).to.equal('missed')
      expect(result.tp_result).to.equal(null)
      expect(result.home_score).to.equal(14)
      expect(result.away_score).to.equal(7)
    })

    it('preserves null values (not charted)', () => {
      const source = {
        pressure: null,
        blitz: null,
        coverageScheme: null,
        expectedPointsAdded: null,
        splitRun: null
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.qb_pressure).to.equal(null)
      expect(result.blitz).to.equal(null)
      expect(result.coverage_type).to.equal(null)
      expect(result.epa_charting).to.equal(null)
      expect(result.split_run).to.equal(null)
    })

    it('maps coverage and personnel fields', () => {
      const source = {
        coverageScheme: 'COVER 3',
        manZoneCoverage: 'ZONE',
        quarterbackAlignment: 'SHOTGUN',
        formation: 'SINGLEBACK',
        offensivePersonnelBasic: '11',
        defensivePersonnelPackage: 'Nickel'
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.coverage_type).to.equal('COVER_3')
      expect(result.man_zone).to.equal('ZONE')
      expect(result.qb_position).to.equal('SHOTGUN')
      expect(result.off_formation).to.equal('SINGLEBACK')
      expect(result.off_personnel).to.equal('11')
      expect(result.def_personnel).to.equal('Nickel')
    })

    it('maps new charting-exclusive columns', () => {
      const source = {
        expectedPointsAdded: 0.345,
        dropbackDepth: 7.2,
        playActionConcept: 'BOOT',
        middleOfFieldCoveragePlayed: 'OPEN',
        middleOfFieldCoverageLook: 'CLOSED',
        passWidth: 12.5,
        quarterbackScrambleSide: 'LEFT',
        quarterbackLeftPocket: true,
        isOwnFumbleRecovery: false,
        playType: 'PASS',
        penaltyOutcome: 'DECLINED'
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.epa_charting).to.equal(0.345)
      expect(result.dropback_depth).to.equal(7.2)
      expect(result.play_action_concept).to.equal('BOOT')
      expect(result.mofc_played).to.equal('OPEN')
      expect(result.mofc_look).to.equal('CLOSED')
      expect(result.pass_width).to.equal(12.5)
      expect(result.qb_scramble_side).to.equal('LEFT')
      expect(result.qb_left_pocket).to.equal(true)
      expect(result.own_fumble_recovery).to.equal(false)
      expect(result.charting_play_type).to.equal('PASS')
      expect(result.charting_penalty_outcome).to.equal('DECLINED')
    })

    it('maps fieldPosition to ydl_100', () => {
      const source = {
        fieldPosition: -25
      }

      const result = map_charting_play_to_db_fields(source)
      // -25 = own 25 yard line = 75 yards to opponent end zone
      expect(result.ydl_100).to.equal(75)
    })

    it('maps clock to sec_rem_qtr', () => {
      const source = {
        clock: '0:02:00'
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.sec_rem_qtr).to.equal(120)
    })

    it('maps runSide to run_location', () => {
      const source = {
        runSide: 'left'
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.run_location).to.equal('LEFT')
    })

    it('resolves sumer team IDs to NFL abbreviations', () => {
      const source = {
        sumerOffenseTeamId: '645fddd1-df20-5323-93e4-c7c176baa507',
        sumerDefenseTeamId: 'e871178d-ca00-52ff-9e93-e3f7a8a9bc9f'
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.off).to.equal('BUF')
      expect(result.def).to.equal('HOU')
    })

    it('handles unknown sumer team IDs gracefully', () => {
      const source = {
        sumerOffenseTeamId: 'unknown-uuid',
        sumerDefenseTeamId: null
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result).to.not.have.property('off')
      expect(result).to.not.have.property('def')
    })

    it('does not include undefined fields in output', () => {
      const source = {
        quarter: 1
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.qtr).to.equal(1)
      expect(result).to.not.have.property('dwn')
      expect(result).to.not.have.property('pass')
      expect(result).to.not.have.property('epa_charting')
    })
  })
})
