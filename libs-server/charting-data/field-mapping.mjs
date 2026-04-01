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
  // ydl_100 = yards remaining to opponent's end zone
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
  'COVER_0', 'COVER_1', 'COVER_2', 'COVER_2_MAN',
  'COVER_3', 'COVER_4', 'COVER_5', 'COVER_6',
  'COVER_9', 'COMBINATION', 'REDZONE'
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
  quarter: 'qtr',
  down: 'dwn',
  distance: 'yards_to_go',
  isPassAttempt: 'pass',
  rushAttempt: 'rush',
  passingYards: 'pass_yds',
  rushYards: 'rush_yds',
  isPenalty: 'penalty',
  penaltyYards: 'pen_yds',
  isTouchdown: 'td',
  isFumble: 'fum',
  fumbleLost: 'fuml',
  isInterception: 'int',
  isSack: 'sk',
  offensiveYards: 'yds_gained',
  isCompletePass: 'comp',
  screen: 'screen_pass',
  playAction: 'play_action',
  isMotion: 'motion',
  pressure: 'qb_pressure',
  scoringPlay: 'score',
  isHit: 'qb_hit',
  designedQuarterbackRun: 'qb_rush',
  quarterbackScramble: 'qb_scramble',
  stunt: 'stunt',
  hurry: 'qb_hurry',
  boxDefenders: 'box_defenders',
  yardsAfterContact: 'yards_after_any_contact',
  yardsAfterCatch: 'yards_after_catch',
  runPassOption: 'run_play_option',
  timeToPressure: 'time_to_pressure',
  timeToThrow: 'time_to_throw',
  depthOfTarget: 'dot',
  isDropback: 'qb_dropback',
  passRushCount: 'pass_rushers',
  blitz: 'blitz',

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
  quarterbackScrambleSide: 'qb_scramble_side',
  splitRun: 'split_run',
  reverseRun: 'reverse_run',
  pitchRun: 'pitch_run',
  optionRun: 'option_run',
  quarterbackLeftPocket: 'qb_left_pocket',
  endAroundRun: 'end_around_run',
  jetSweepRun: 'jet_sweep_run',
  leadRun: 'lead_run',
  isOwnFumbleRecovery: 'own_fumble_recovery',
  playType: 'charting_play_type',
  penaltyOutcome: 'charting_penalty_outcome'
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

  // fieldPosition -> ydl_100
  if ('fieldPosition' in source_play) {
    result.ydl_100 = convert_field_position_to_ydl_100(
      source_play.fieldPosition
    )
  }

  // clock -> sec_rem_qtr
  if ('clock' in source_play) {
    result.sec_rem_qtr = parse_clock_to_seconds(source_play.clock)
  }

  // coverageScheme -> coverage_type (enum: COVER_0, COVER_1, COVER_2, COVER_2_MAN, etc.)
  if ('coverageScheme' in source_play && source_play.coverageScheme !== undefined) {
    result.coverage_type = normalize_coverage_type(source_play.coverageScheme)
  }

  // manZoneCoverage -> man_zone
  if ('manZoneCoverage' in source_play && source_play.manZoneCoverage !== undefined) {
    result.man_zone = source_play.manZoneCoverage
  }

  // quarterbackAlignment -> qb_position
  if ('quarterbackAlignment' in source_play) {
    result.qb_position = map_qb_alignment(source_play.quarterbackAlignment)
  }

  // formation -> off_formation
  if ('formation' in source_play && source_play.formation !== undefined) {
    result.off_formation = source_play.formation
  }

  // offensivePersonnelBasic -> off_personnel
  if ('offensivePersonnelBasic' in source_play && source_play.offensivePersonnelBasic !== undefined) {
    result.off_personnel = source_play.offensivePersonnelBasic
  }

  // defensivePersonnelPackage -> def_personnel
  if ('defensivePersonnelPackage' in source_play && source_play.defensivePersonnelPackage !== undefined) {
    result.def_personnel = source_play.defensivePersonnelPackage
  }

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

  // fieldGoalMade -> fg_result
  if ('fieldGoalMade' in source_play) {
    result.fg_result = map_boolean_to_kick_result(source_play.fieldGoalMade)
  }

  // extraPointMade -> ep_result
  if ('extraPointMade' in source_play) {
    result.ep_result = map_boolean_to_kick_result(source_play.extraPointMade)
  }

  // twoPointMade -> tp_result
  if ('twoPointMade' in source_play) {
    result.tp_result = map_boolean_to_two_point_result(source_play.twoPointMade)
  }

  // Score fields (API uses homeScoreAtStartOfPlay / awayScoreAtStartOfPlay)
  if ('homeScoreAtStartOfPlay' in source_play && source_play.homeScoreAtStartOfPlay !== undefined) {
    result.home_score = source_play.homeScoreAtStartOfPlay
  }
  if ('awayScoreAtStartOfPlay' in source_play && source_play.awayScoreAtStartOfPlay !== undefined) {
    result.away_score = source_play.awayScoreAtStartOfPlay
  }

  // Team fields from sumer team UUIDs
  if (source_play.sumerOffenseTeamId) {
    const off = resolve_sumer_team(source_play.sumerOffenseTeamId)
    if (off) result.off = off
  }
  if (source_play.sumerDefenseTeamId) {
    const def = resolve_sumer_team(source_play.sumerDefenseTeamId)
    if (def) result.def = def
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
