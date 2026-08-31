/* global describe it */

import * as chai from 'chai'

import {
  map_charting_play_to_db_fields,
  parse_clock_to_seconds,
  convert_field_position_to_ydl_100,
  map_qb_alignment,
  normalize_coverage_type,
  FIELD_MAPPINGS
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
    it('converts own territory (negative) to yard_line_100', () => {
      // -25 means own 25 yard line = 75 yards to opponent end zone
      expect(convert_field_position_to_ydl_100(-25)).to.equal(75)
    })

    it('converts opponent territory (positive) to yard_line_100', () => {
      // +25 means opponent 25 = 25 yards to opponent end zone
      expect(convert_field_position_to_ydl_100(25)).to.equal(25)
    })

    it('converts midfield (0) to yard_line_100', () => {
      expect(convert_field_position_to_ydl_100(0)).to.equal(50)
    })

    it('converts own goal line (-50) to yard_line_100', () => {
      // Own 50 = midfield from own side = 50 yards to opponent end zone
      expect(convert_field_position_to_ydl_100(-50)).to.equal(50)
    })

    it('converts opponent goal line (+50) to yard_line_100', () => {
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
      expect(result.quarter).to.equal(2)
      expect(result.down_number).to.equal(3)
      expect(result.yards_to_go).to.equal(7)
      expect(result.is_passing_play).to.equal(true)
      expect(result.is_rushing_play).to.equal(false)
      expect(result.pass_yards).to.equal(15)
      expect(result.is_completion).to.equal(true)
      expect(result.is_touchdown).to.equal(false)
      expect(result.is_penalty).to.equal(false)
      expect(result.is_qb_pressure).to.equal(false)
      expect(result.is_blitz).to.equal(true)
      expect(result.time_to_throw).to.equal(2.8)
      expect(result.depth_of_target).to.equal(12)
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
      expect(result.is_rushing_play).to.equal(true)
      expect(result.rush_yards).to.equal(5)
      expect(result.run_concept).to.equal('OUTSIDE_ZONE')
      expect(result.run_gap_intent).to.equal('C_GAP')
      expect(result.run_gap_intent_side).to.equal('LEFT')
      expect(result.is_split_run).to.equal(false)
      expect(result.is_reverse_run).to.equal(false)
      expect(result.is_lead_run).to.equal(true)
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
      expect(result.field_goal_result).to.equal('made')
      expect(result.extra_point_result).to.equal('missed')
      expect(result.two_point_result).to.equal(null)
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
      expect(result.is_qb_pressure).to.equal(null)
      expect(result.is_blitz).to.equal(null)
      expect(result.coverage_type).to.equal(null)
      expect(result.epa_charting).to.equal(null)
      expect(result.is_split_run).to.equal(null)
    })

    it('maps the coverage fields it owns', () => {
      const source = {
        coverageScheme: 'COVER 3',
        manZoneCoverage: 'ZONE',
        quarterbackAlignment: 'SHOTGUN'
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.coverage_type).to.equal('COVER_3')
      expect(result.man_zone).to.equal('ZONE')
      expect(result.quarterback_position).to.equal('SHOTGUN')
    })

    // These three fields name columns the NFL feed owns, and this importer calls
    // update_play with no protected_fields, so mapping them made it a second
    // writer that filled wherever that feed left NULL -- a second vocabulary in
    // one column, measured at 462, 3,507 and 2,004 rows and none of it present
    // in any season before the vendor arrived. The values use the vendor's own
    // vocabulary here on purpose: a mapping restored by someone reading only
    // the field names would put exactly these strings into those columns.
    it('does not write the formation and personnel columns the NFL feed owns', () => {
      const source = {
        formation: '1x3',
        offensivePersonnelBasic: '11',
        defensivePersonnelPackage: 'Nickel'
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result).to.not.have.property('offense_formation')
      expect(result).to.not.have.property('offense_personnel')
      expect(result).to.not.have.property('defense_personnel')
    })

    // The vendor's formation is directional; the NFL feed's receiver_alignment
    // is normalized strong-side-first and cannot express 1x3. A right-heavy
    // value is therefore the control that proves this landed in the vendor's
    // own column and was not normalized in transit.
    it('maps formation to receiver_alignment_charting, not receiver_alignment', () => {
      const result = map_charting_play_to_db_fields({ formation: '1x3' })
      expect(result.receiver_alignment_charting).to.equal('1x3')
      expect(result).to.not.have.property('receiver_alignment')
    })

    it('maps coverageDefenders to coverage_defenders', () => {
      const result = map_charting_play_to_db_fields({ coverageDefenders: 7 })
      expect(result.coverage_defenders).to.equal(7)
    })

    it('does not write is_motion, which the vendor never returns', () => {
      const result = map_charting_play_to_db_fields({ isMotion: true })
      expect(result).to.not.have.property('is_motion')
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
      expect(result.quarterback_scramble_side).to.equal('LEFT')
      expect(result.is_qb_left_pocket).to.equal(true)
      expect(result.is_own_fumble_recovery).to.equal(false)
      expect(result.charting_play_type).to.equal('PASS')
      expect(result.charting_penalty_outcome).to.equal('DECLINED')
    })

    it('maps fieldPosition to yard_line_100', () => {
      const source = {
        fieldPosition: -25
      }

      const result = map_charting_play_to_db_fields(source)
      // -25 = own 25 yard line = 75 yards to opponent end zone
      expect(result.yard_line_100).to.equal(75)
    })

    it('maps clock to seconds_remaining_quarter', () => {
      const source = {
        clock: '0:02:00'
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.seconds_remaining_quarter).to.equal(120)
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
      expect(result.offense_nfl_team).to.equal('BUF')
      expect(result.defense_nfl_team).to.equal('HOU')
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

    // The allowlist below is the whole point of this block, and it is written
    // out by hand rather than derived from FIELD_MAPPINGS on purpose: a list
    // built from the mapper would agree with the mapper by construction and
    // could never fail. Adding a mapping means adding its column here, which is
    // the moment a reviewer gets to ask whether the NFL feed already owns it.
    //
    // This importer calls update_play with no protected_fields, so any column
    // named here is filled wherever the authoritative feed left NULL. That is
    // correct for the charting-exclusive columns and silent corruption for a
    // column another source owns -- the failure that put three vocabularies
    // into offense_formation, offense_personnel and defense_personnel. Those
    // three are absent from this list, and the test above pins them
    // individually; this one catches the NEXT column instead of the last three.
    const ALLOWED_OUTPUT_COLUMNS = [
      // Direct mappings onto columns the charting vendor may fill
      'quarter',
      'down_number',
      'yards_to_go',
      'is_passing_play',
      'is_rushing_play',
      'pass_yards',
      'rush_yards',
      'is_penalty',
      'penalty_yards',
      'is_touchdown',
      'is_fumble',
      'is_fumble_lost',
      'is_interception',
      'is_sack',
      'yards_gained',
      'is_completion',
      'is_screen_pass',
      'is_play_action',
      'is_qb_pressure',
      'is_scoring_play',
      'is_qb_hit',
      'is_qb_rush',
      'is_qb_scramble',
      'is_stunt',
      'is_qb_hurry',
      'box_defenders',
      'yards_after_any_contact',
      'yards_after_catch',
      'is_run_play_option',
      'time_to_pressure',
      'time_to_throw',
      'depth_of_target',
      'is_qb_dropback',
      'pass_rushers',
      'is_blitz',

      // Charting-exclusive columns -- this vendor is the only writer
      'epa_charting',
      'dropback_depth',
      'play_action_concept',
      'run_concept',
      'run_gap_intent',
      'run_gap_intent_side',
      'run_gap_outcome',
      'run_gap_outcome_side',
      'mofc_played',
      'mofc_look',
      'pass_width',
      'quarterback_scramble_side',
      'is_split_run',
      'is_reverse_run',
      'is_pitch_run',
      'is_option_run',
      'is_qb_left_pocket',
      'is_end_around_run',
      'is_jet_sweep_run',
      'is_lead_run',
      'is_own_fumble_recovery',
      'charting_play_type',
      'charting_penalty_outcome',
      'coverage_defenders',
      'receiver_alignment_charting',

      // Written by the transformation block rather than a direct mapping
      'yard_line_100',
      'seconds_remaining_quarter',
      'coverage_type',
      'man_zone',
      'quarterback_position',
      'run_location',
      'field_goal_result',
      'extra_point_result',
      'two_point_result',
      'home_score',
      'away_score',
      'offense_nfl_team',
      'defense_nfl_team'
    ]

    // The INPUT is derived from FIELD_MAPPINGS and the OUTPUT allowlist is not,
    // and that split is deliberate. Deriving the input is what gives coverage:
    // the mapper only writes a column when its source key is present, so a
    // fixture that hand-lists vendor keys is blind to a mapping added under a
    // key nobody thought to add -- which is precisely how the next bad mapping
    // arrives. Caught here by controlled experiment: with the vendor keys hand
    // listed, adding boxDefenders2 -> box_defenders_charted passed this test.
    // Deriving the assertion too would make it vacuous, so only the input is.
    //
    // The transformation block reads keys that are not in FIELD_MAPPINGS, so
    // those stay hand-listed below; they change by editing that block, which is
    // not the mechanical add this guards against.
    const transformation_source_keys = {
      fieldPosition: -25,
      clock: '0:02:00',
      coverageScheme: 'COVER 3',
      manZoneCoverage: 'ZONE',
      quarterbackAlignment: 'SHOTGUN',
      runSide: 'left',
      fieldGoalMade: null,
      extraPointMade: null,
      twoPointMade: null,
      homeScoreAtStartOfPlay: 14,
      awayScoreAtStartOfPlay: 7,
      sumerOffenseTeamId: '645fddd1-df20-5323-93e4-c7c176baa507',
      sumerDefenseTeamId: 'e871178d-ca00-52ff-9e93-e3f7a8a9bc9f',

      // Read by nothing, and that is the assertion -- see the isMotion note in
      // field-mapping.mjs. Present here so a restored mapping fails this test.
      isMotion: true,
      offensivePersonnelBasic: '11',
      defensivePersonnelPackage: 'Nickel'
    }

    // A placeholder for the mapped keys, which are copied through verbatim, so
    // this covers a mapping added under a key this file has never heard of.
    const build_every_source_key = () => {
      const source = { ...transformation_source_keys }
      for (const source_field of Object.keys(FIELD_MAPPINGS)) {
        if (!(source_field in source)) source[source_field] = 1
      }
      return source
    }

    it('writes only allowlisted columns', () => {
      const result = map_charting_play_to_db_fields(build_every_source_key())

      const written = Object.keys(result).sort()
      const allowed = [...ALLOWED_OUTPUT_COLUMNS].sort()

      // Reported as two directed differences rather than a set comparison, so a
      // failure says which way it drifted instead of printing two long lists.
      const unexpected = written.filter((c) => !allowed.includes(c))
      const missing = allowed.filter((c) => !written.includes(c))

      expect(
        unexpected,
        'mapper writes a column that is not on the allowlist -- if the charting vendor may legitimately own it, add it to ALLOWED_OUTPUT_COLUMNS; if an NFL feed owns it, this is the corruption class the allowlist exists to catch'
      ).to.deep.equal([])
      expect(
        missing,
        'allowlist names a column the mapper no longer writes -- remove it if the mapping was dropped on purpose'
      ).to.deep.equal([])
    })

    it('does not include undefined fields in output', () => {
      const source = {
        quarter: 1
      }

      const result = map_charting_play_to_db_fields(source)
      expect(result.quarter).to.equal(1)
      expect(result).to.not.have.property('down_number')
      expect(result).to.not.have.property('pass')
      expect(result).to.not.have.property('epa_charting')
    })
  })
})
