import { resolve_sumer_team } from '#libs-server/charting-data/team-mapping.mjs'

const parse_clock_to_seconds = (clock_string) => {
  if (!clock_string) return null
  // Format: "HH:MM:SS" or "MM:SS"
  const parts = clock_string.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return null
}

const convert_field_position_to_ydl_100 = (field_position) => {
  // fieldPosition: negative = own yardline number (e.g., -28 = own 28)
  //                positive = opponent yardline number (e.g., 22 = opponent's 22)
  // yard_line_100 = yards remaining to opponent's end zone
  if (field_position === null || field_position === undefined) return null
  const fp = Number(field_position)
  if (Number.isNaN(fp)) return null
  if (fp < 0) {
    // Own territory: own 28 = 72 yards to opponent end zone
    return 100 - Math.abs(fp)
  }
  if (fp > 0) {
    // Opponent territory: opponent's 22 = 22 yards to their end zone
    return fp
  }
  return 50 // midfield
}

const VALID_COVERAGE_TYPES = new Set([
  'COVER_0',
  'COVER_1',
  'COVER_2',
  'COVER_2_MAN',
  'COVER_3',
  'COVER_4',
  'COVER_5',
  'COVER_6',
  'COVER_9',
  'COMBINATION'
])

const normalize_coverage_type = (value) => {
  if (!value) return null
  // Normalize: "COVER 2 MAN" -> "COVER_2_MAN", "COVER 3" -> "COVER_3"
  const normalized = value.toUpperCase().trim().replace(/\s+/g, '_')
  if (VALID_COVERAGE_TYPES.has(normalized)) return normalized
  return null
}

const map_qb_alignment = (alignment) => {
  if (!alignment) return null
  const normalized = alignment.toUpperCase().trim()
  switch (normalized) {
    case 'SHOTGUN':
      return 'SHOTGUN'
    case 'UNDER CENTER':
    case 'UNDER_CENTER':
      return 'UNDER_CENTER'
    case 'PISTOL':
      return 'PISTOL'
    default:
      return normalized
  }
}

const map_boolean_to_kick_result = (made) => {
  if (made === null || made === undefined) return null
  return made ? 'made' : 'missed'
}

const map_boolean_to_two_point_result = (made) => {
  if (made === null || made === undefined) return null
  return made ? 'success' : 'failure'
}

// Source field -> nfl_plays column mappings
const FIELD_MAPPINGS = {
  // Existing columns (direct mappings)
  quarter: 'quarter',
  down: 'down_number',
  distance: 'yards_to_go',
  isPassAttempt: 'is_passing_play',
  rushAttempt: 'is_rushing_play',
  passingYards: 'pass_yards',
  rushYards: 'rush_yards',
  isPenalty: 'is_penalty',
  penaltyYards: 'penalty_yards',
  isTouchdown: 'is_touchdown',
  isFumble: 'is_fumble',
  fumbleLost: 'is_fumble_lost',
  isInterception: 'is_interception',
  isSack: 'is_sack',
  offensiveYards: 'yards_gained',
  isCompletePass: 'is_completion',
  screen: 'is_screen_pass',
  playAction: 'is_play_action',
  // isMotion is not mapped: the vendor never returns it (no motion- or
  // shift-like key appears among the 97 distinct keys on a 190-play sample),
  // so the entry only stood ready to make this a third writer of is_motion.
  pressure: 'is_qb_pressure',
  scoringPlay: 'is_scoring_play',
  isHit: 'is_qb_hit',
  designedQuarterbackRun: 'is_qb_rush',
  quarterbackScramble: 'is_qb_scramble',
  stunt: 'is_stunt',
  hurry: 'is_qb_hurry',
  boxDefenders: 'box_defenders',
  yardsAfterContact: 'yards_after_any_contact',
  yardsAfterCatch: 'yards_after_catch',
  runPassOption: 'is_run_play_option',
  timeToPressure: 'time_to_pressure',
  timeToThrow: 'time_to_throw',
  depthOfTarget: 'depth_of_target',
  isDropback: 'is_qb_dropback',
  passRushCount: 'pass_rushers',
  blitz: 'is_blitz',

  // Charting-exclusive columns
  expectedPointsAdded: 'epa_charting',
  dropbackDepth: 'dropback_depth',
  playActionConcept: 'play_action_concept',
  runConcept: 'run_concept',
  runGapIntent: 'run_gap_intent',
  runGapIntentSide: 'run_gap_intent_side',
  runGapOutcome: 'run_gap_outcome',
  runGapOutcomeSide: 'run_gap_outcome_side',
  middleOfFieldCoveragePlayed: 'mofc_played',
  middleOfFieldCoverageLook: 'mofc_look',
  passWidth: 'pass_width',
  quarterbackScrambleSide: 'quarterback_scramble_side',
  splitRun: 'is_split_run',
  reverseRun: 'is_reverse_run',
  pitchRun: 'is_pitch_run',
  optionRun: 'is_option_run',
  quarterbackLeftPocket: 'is_qb_left_pocket',
  endAroundRun: 'is_end_around_run',
  jetSweepRun: 'is_jet_sweep_run',
  leadRun: 'is_lead_run',
  isOwnFumbleRecovery: 'is_own_fumble_recovery',
  playType: 'charting_play_type',
  penaltyOutcome: 'charting_penalty_outcome',
  coverageDefenders: 'coverage_defenders',
  // Deliberately NOT offense_formation, and deliberately NOT the NFL feed's
  // receiver_alignment -- see the note in the transformation block below.
  formation: 'receiver_alignment_charting'
}

export function map_charting_play_to_db_fields(source_play) {
  const result = {}

  // Apply field mappings
  for (const [source_field, db_field] of Object.entries(FIELD_MAPPINGS)) {
    if (source_field in source_play) {
      const value = source_play[source_field]
      if (value === undefined) continue
      result[db_field] = value
    }
  }

  // Transformation mappings

  // fieldPosition -> yard_line_100
  if ('fieldPosition' in source_play) {
    result.yard_line_100 = convert_field_position_to_ydl_100(
      source_play.fieldPosition
    )
  }

  // clock -> seconds_remaining_quarter
  if ('clock' in source_play) {
    result.seconds_remaining_quarter = parse_clock_to_seconds(source_play.clock)
  }

  // coverageScheme -> coverage_type (enum: COVER_0, COVER_1, COVER_2, COVER_2_MAN, etc.)
  if (
    'coverageScheme' in source_play &&
    source_play.coverageScheme !== undefined
  ) {
    result.coverage_type = normalize_coverage_type(source_play.coverageScheme)
  }

  // manZoneCoverage -> man_zone
  if (
    'manZoneCoverage' in source_play &&
    source_play.manZoneCoverage !== undefined
  ) {
    result.man_zone = source_play.manZoneCoverage
  }

  // quarterbackAlignment -> quarterback_position
  if ('quarterbackAlignment' in source_play) {
    result.quarterback_position = map_qb_alignment(
      source_play.quarterbackAlignment
    )
  }

  // offensivePersonnelBasic and defensivePersonnelPackage are deliberately NOT
  // mapped, and `formation` is deliberately mapped somewhere else. Each named
  // an existing column owned by the NFL feed, and update_play is called here
  // with no protected_fields, so this importer filled wherever that feed left
  // NULL -- putting a second, incompatible vocabulary into one column:
  //
  //   offense_formation   directional NxN receiver splits against SHOTGUN /
  //                       SINGLEBACK / I_FORM. Measured 462 rows, 2025 only.
  //   offense_personnel   two-digit codes (11, 01*) against "1 RB, 1 TE, 3 WR".
  //                       3,507 rows, and zero in any season before 2025.
  //   defense_personnel   package names (Other, Base, Nickel, Dime) against
  //                       "2 DL, 4 LB, 5 DB". 2,004 rows, likewise 2025 only.
  //
  // The two personnel vocabularies have no destination here and are dropped.
  // The vendor's formation is a real fact we want, so it gets its own column,
  // receiver_alignment_charting -- and NOT the NFL feed's receiver_alignment,
  // which looks like the same vocabulary and is not: that column is normalized
  // strong-side-first and never emits a right-heavy value, while this vendor is
  // directional and emits 1x3 alongside 3x1.
  //
  // runSide -> run_location
  if ('runSide' in source_play && source_play.runSide !== undefined) {
    const run_side = source_play.runSide
    if (run_side) {
      const normalized = run_side.toUpperCase().trim()
      if (['LEFT', 'RIGHT', 'MIDDLE'].includes(normalized)) {
        result.run_location = normalized
      }
    } else {
      result.run_location = null
    }
  }

  // fieldGoalMade -> field_goal_result
  if ('fieldGoalMade' in source_play) {
    result.field_goal_result = map_boolean_to_kick_result(
      source_play.fieldGoalMade
    )
  }

  // extraPointMade -> extra_point_result
  if ('extraPointMade' in source_play) {
    result.extra_point_result = map_boolean_to_kick_result(
      source_play.extraPointMade
    )
  }

  // twoPointMade -> two_point_result
  if ('twoPointMade' in source_play) {
    result.two_point_result = map_boolean_to_two_point_result(
      source_play.twoPointMade
    )
  }

  // Score fields (API uses homeScoreAtStartOfPlay / awayScoreAtStartOfPlay)
  if (
    'homeScoreAtStartOfPlay' in source_play &&
    source_play.homeScoreAtStartOfPlay !== undefined
  ) {
    result.home_score = source_play.homeScoreAtStartOfPlay
  }
  if (
    'awayScoreAtStartOfPlay' in source_play &&
    source_play.awayScoreAtStartOfPlay !== undefined
  ) {
    result.away_score = source_play.awayScoreAtStartOfPlay
  }

  // Team fields from sumer team UUIDs
  if (source_play.sumerOffenseTeamId) {
    const off = resolve_sumer_team(source_play.sumerOffenseTeamId)
    if (off) result.offense_nfl_team = off
  }
  if (source_play.sumerDefenseTeamId) {
    const def = resolve_sumer_team(source_play.sumerDefenseTeamId)
    if (def) result.defense_nfl_team = def
  }

  return result
}

export {
  parse_clock_to_seconds,
  convert_field_position_to_ydl_100,
  map_qb_alignment,
  normalize_coverage_type,
  FIELD_MAPPINGS
}
