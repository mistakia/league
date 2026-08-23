import {
  player_prop_types,
  team_game_market_types
} from '#libs-shared/bookmaker-constants.mjs'

const create_player_regex = (suffix) =>
  new RegExp(`^PLAYER_[A-Z](_-_|_)${suffix}$`)

const alt_quarter_markets = [
  // First quarter alt lines
  [
    create_player_regex('1ST_QTR_RUSHING_YDS'),
    player_prop_types.GAME_FIRST_QUARTER_ALT_RUSHING_YARDS
  ],
  [
    create_player_regex('1ST_QTR_RECEIVING_YDS'),
    player_prop_types.GAME_FIRST_QUARTER_ALT_RECEIVING_YARDS
  ],
  [
    create_player_regex('1ST_QTR_PASSING_YDS'),
    player_prop_types.GAME_FIRST_QUARTER_ALT_PASSING_YARDS
  ],
  [
    create_player_regex('1ST_QTR_PASSING_\\+_RUSHING_YDS'),
    player_prop_types.GAME_FIRST_QUARTER_ALT_PASSING_RUSHING_YARDS
  ],
  [
    create_player_regex('1ST_QTR_RUSHING_\\+_RECEIVING_YDS'),
    player_prop_types.GAME_FIRST_QUARTER_ALT_RUSHING_RECEIVING_YARDS
  ],

  // Second quarter alt lines
  [
    create_player_regex('2ND_QTR_RUSHING_YDS'),
    player_prop_types.GAME_SECOND_QUARTER_ALT_RUSHING_YARDS
  ],
  [
    create_player_regex('2ND_QTR_RECEIVING_YDS'),
    player_prop_types.GAME_SECOND_QUARTER_ALT_RECEIVING_YARDS
  ],
  [
    create_player_regex('2ND_QTR_PASSING_YDS'),
    player_prop_types.GAME_SECOND_QUARTER_ALT_PASSING_YARDS
  ],
  [
    create_player_regex('2ND_QTR_PASSING_\\+_RUSHING_YDS'),
    player_prop_types.GAME_SECOND_QUARTER_ALT_PASSING_RUSHING_YARDS
  ],
  [
    create_player_regex('2ND_QTR_RUSHING_\\+_RECEIVING_YDS'),
    player_prop_types.GAME_SECOND_QUARTER_ALT_RUSHING_RECEIVING_YARDS
  ],

  // Third quarter alt lines
  [
    create_player_regex('3RD_QTR_RUSHING_YDS'),
    player_prop_types.GAME_THIRD_QUARTER_ALT_RUSHING_YARDS
  ],
  [
    create_player_regex('3RD_QTR_RECEIVING_YDS'),
    player_prop_types.GAME_THIRD_QUARTER_ALT_RECEIVING_YARDS
  ],
  [
    create_player_regex('3RD_QTR_PASSING_YDS'),
    player_prop_types.GAME_THIRD_QUARTER_ALT_PASSING_YARDS
  ],
  [
    create_player_regex('3RD_QTR_PASSING_\\+_RUSHING_YDS'),
    player_prop_types.GAME_THIRD_QUARTER_ALT_PASSING_RUSHING_YARDS
  ],
  [
    create_player_regex('3RD_QTR_RUSHING_\\+_RECEIVING_YDS'),
    player_prop_types.GAME_THIRD_QUARTER_ALT_RUSHING_RECEIVING_YARDS
  ],

  // Fourth quarter alt lines
  [
    create_player_regex('4TH_QTR_RUSHING_YDS'),
    player_prop_types.GAME_FOURTH_QUARTER_ALT_RUSHING_YARDS
  ],
  [
    create_player_regex('4TH_QTR_RECEIVING_YDS'),
    player_prop_types.GAME_FOURTH_QUARTER_ALT_RECEIVING_YARDS
  ],
  [
    create_player_regex('4TH_QTR_PASSING_YDS'),
    player_prop_types.GAME_FOURTH_QUARTER_ALT_PASSING_YARDS
  ],
  [
    create_player_regex('4TH_QTR_PASSING_\\+_RUSHING_YDS'),
    player_prop_types.GAME_FOURTH_QUARTER_ALT_PASSING_RUSHING_YARDS
  ],
  [
    create_player_regex('4TH_QTR_RUSHING_\\+_RECEIVING_YDS'),
    player_prop_types.GAME_FOURTH_QUARTER_ALT_RUSHING_RECEIVING_YARDS
  ]
]

const player_game_alt_line_markets = [
  [
    create_player_regex('ALT_PASSING_YARDS'),
    player_prop_types.GAME_ALT_PASSING_YARDS
  ],
  [
    create_player_regex('ALT_PASSING_TDS'),
    player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS
  ],
  [
    create_player_regex('ALT_RUSH_YARDS'),
    player_prop_types.GAME_ALT_RUSHING_YARDS
  ],
  [
    create_player_regex('ALT_RECEIVING_YARDS'),
    player_prop_types.GAME_ALT_RECEIVING_YARDS
  ],
  [
    create_player_regex('ALT_RECEPTIONS'),
    player_prop_types.GAME_ALT_RECEPTIONS
  ],
  [
    create_player_regex('ALT_PASSING_\\+_RUSHING_YDS'),
    player_prop_types.GAME_ALT_PASSING_RUSHING_YARDS
  ],
  [
    create_player_regex('ALT_RUSHING_\\+_RECEIVING_YDS'),
    player_prop_types.GAME_ALT_RUSHING_RECEIVING_YARDS
  ],
  ...alt_quarter_markets
]

const quarter_markets = [
  // First quarter standard lines
  [
    create_player_regex('1ST_QTR_TOTAL_RUSH_YDS'),
    player_prop_types.GAME_FIRST_QUARTER_RUSHING_YARDS
  ],
  [
    create_player_regex('1ST_QTR_TOTAL_REC_YDS'),
    player_prop_types.GAME_FIRST_QUARTER_RECEIVING_YARDS
  ],
  [
    create_player_regex('1ST_QTR_TOTAL_PASS_YDS'),
    player_prop_types.GAME_FIRST_QUARTER_PASSING_YARDS
  ],
  [
    create_player_regex('1ST_QTR_TOTAL_PASS_\\+_RUSH_YDS'),
    player_prop_types.GAME_FIRST_QUARTER_PASSING_RUSHING_YARDS
  ],
  [
    create_player_regex('1ST_QTR_TOTAL_RUSH_\\+_REC_YDS'),
    player_prop_types.GAME_FIRST_QUARTER_RUSHING_RECEIVING_YARDS
  ],

  // Second quarter standard lines
  [
    create_player_regex('2ND_QTR_TOTAL_RUSH_YDS'),
    player_prop_types.GAME_SECOND_QUARTER_RUSHING_YARDS
  ],
  [
    create_player_regex('2ND_QTR_TOTAL_REC_YDS'),
    player_prop_types.GAME_SECOND_QUARTER_RECEIVING_YARDS
  ],
  [
    create_player_regex('2ND_QTR_TOTAL_PASS_YDS'),
    player_prop_types.GAME_SECOND_QUARTER_PASSING_YARDS
  ],
  [
    create_player_regex('2ND_QTR_TOTAL_PASS_\\+_RUSH_YDS'),
    player_prop_types.GAME_SECOND_QUARTER_PASSING_RUSHING_YARDS
  ],
  [
    create_player_regex('2ND_QTR_TOTAL_RUSH_\\+_REC_YDS'),
    player_prop_types.GAME_SECOND_QUARTER_RUSHING_RECEIVING_YARDS
  ],

  // Third quarter standard lines
  [
    create_player_regex('3RD_QTR_TOTAL_RUSH_YDS'),
    player_prop_types.GAME_THIRD_QUARTER_RUSHING_YARDS
  ],
  [
    create_player_regex('3RD_QTR_TOTAL_REC_YDS'),
    player_prop_types.GAME_THIRD_QUARTER_RECEIVING_YARDS
  ],
  [
    create_player_regex('3RD_QTR_TOTAL_PASS_YDS'),
    player_prop_types.GAME_THIRD_QUARTER_PASSING_YARDS
  ],
  [
    create_player_regex('3RD_QTR_TOTAL_PASS_\\+_RUSH_YDS'),
    player_prop_types.GAME_THIRD_QUARTER_PASSING_RUSHING_YARDS
  ],
  [
    create_player_regex('3RD_QTR_TOTAL_RUSH_\\+_REC_YDS'),
    player_prop_types.GAME_THIRD_QUARTER_RUSHING_RECEIVING_YARDS
  ],

  // Fourth quarter standard lines
  [
    create_player_regex('4TH_QTR_TOTAL_RUSH_YDS'),
    player_prop_types.GAME_FOURTH_QUARTER_RUSHING_YARDS
  ],
  [
    create_player_regex('4TH_QTR_TOTAL_REC_YDS'),
    player_prop_types.GAME_FOURTH_QUARTER_RECEIVING_YARDS
  ],
  [
    create_player_regex('4TH_QTR_TOTAL_PASS_YDS'),
    player_prop_types.GAME_FOURTH_QUARTER_PASSING_YARDS
  ],
  [
    create_player_regex('4TH_QTR_TOTAL_PASS_\\+_RUSH_YDS'),
    player_prop_types.GAME_FOURTH_QUARTER_PASSING_RUSHING_YARDS
  ],
  [
    create_player_regex('4TH_QTR_TOTAL_RUSH_\\+_REC_YDS'),
    player_prop_types.GAME_FOURTH_QUARTER_RUSHING_RECEIVING_YARDS
  ]
]

const player_game_markets = [
  [
    create_player_regex('TOTAL_PASSING_YARDS'),
    player_prop_types.GAME_PASSING_YARDS
  ],
  [
    create_player_regex('TOTAL_PASSING_\\+_RUSHING_YDS'),
    player_prop_types.GAME_PASSING_RUSHING_YARDS
  ],
  [
    create_player_regex('LONGEST_PASS_COMPLETION'),
    player_prop_types.GAME_PASSING_LONGEST_COMPLETION
  ],
  [
    create_player_regex('TOTAL_PASS_COMPLETIONS'),
    player_prop_types.GAME_PASSING_COMPLETIONS
  ],
  [
    create_player_regex('TOTAL_RUSHING_\\+_RECEIVING_YDS'),
    player_prop_types.GAME_RUSHING_RECEIVING_YARDS
  ],
  [
    create_player_regex('PASS_ATTEMPTS'),
    player_prop_types.GAME_PASSING_ATTEMPTS
  ],
  [
    create_player_regex('TOTAL_PASSING_TOUCHDOWNS'),
    player_prop_types.GAME_PASSING_TOUCHDOWNS
  ],
  [
    create_player_regex('TOTAL_RECEIVING_YARDS'),
    player_prop_types.GAME_RECEIVING_YARDS
  ],
  [create_player_regex('TOTAL_RECEPTIONS'), player_prop_types.GAME_RECEPTIONS],
  [
    create_player_regex('LONGEST_RECEPTION'),
    player_prop_types.GAME_LONGEST_RECEPTION
  ],
  [
    create_player_regex('TOTAL_RUSHING_YARDS'),
    player_prop_types.GAME_RUSHING_YARDS
  ],
  [
    create_player_regex('TOTAL_RUSH_ATTEMPTS'),
    player_prop_types.GAME_RUSHING_ATTEMPTS
  ],
  [create_player_regex('LONGEST_RUSH'), player_prop_types.GAME_LONGEST_RUSH],
  [
    /^PLAYER_[A-Z]_TOTAL_TACKLES_\+_ASSISTS$/,
    player_prop_types.GAME_TACKLES_ASSISTS
  ],
  [/^ANY_TIME_TOUCHDOWN_SCORER$/, player_prop_types.ANYTIME_TOUCHDOWN],
  [/^TO_SCORE_2\+_TOUCHDOWNS$/, player_prop_types.GAME_TWO_PLUS_TOUCHDOWNS],
  [/^FIRST_TOUCHDOWN_SCORER$/, player_prop_types.GAME_FIRST_TOUCHDOWN_SCORER],
  [/^LAST_TOUCHDOWN_SCORER$/, player_prop_types.GAME_LAST_TOUCHDOWN_SCORER],
  [
    /^1ST_TEAM_TOUCHDOWN_SCORER$/,
    player_prop_types.GAME_FIRST_TEAM_TOUCHDOWN_SCORER
  ],
  ...quarter_markets
]

// Team game market mappings (spreads, totals)
const team_game_markets = [
  [/^ALTERNATE_HANDICAP$/, team_game_market_types.GAME_ALT_SPREAD],
  [/^ALTERNATE_TOTAL$/, team_game_market_types.GAME_ALT_TOTAL]
]

// Helper to create team yardage regex patterns
// FanDuel format: (HOME|AWAY)_[PERIOD_]STAT_TYPE[_-_O/U]
// - Standard markets have _-_O/U suffix, alt markets don't
// - Uses 1ST_QUARTER and 1ST_HALF (not 1ST_QTR)
const create_team_yards_regex = (pattern) =>
  new RegExp(`^(HOME|AWAY)_${pattern}$`)

// Team yardage market mappings organized by time period
const team_yardage_markets = [
  // === Full Game ===
  // Total yards (rushing + receiving combined)
  [
    create_team_yards_regex('TOTAL_YARDS_-_O\\/U'),
    team_game_market_types.GAME_TEAM_TOTAL_YARDS
  ],
  [
    create_team_yards_regex('ALT_TOTAL_YARDS'),
    team_game_market_types.GAME_TEAM_ALT_TOTAL_YARDS
  ],
  // Rushing yards
  [
    create_team_yards_regex('ALT_TOTAL_RUSHING_YARDS'),
    team_game_market_types.GAME_TEAM_ALT_RUSHING_YARDS
  ],
  // Receiving yards
  [
    create_team_yards_regex('ALT_TOTAL_RECEIVING_YARDS'),
    team_game_market_types.GAME_TEAM_ALT_RECEIVING_YARDS
  ],
  // Legacy format (playoffs)
  [/^TEAM_RUSHING_YARDS$/, team_game_market_types.GAME_TEAM_RUSHING_YARDS],

  // === First Half ===
  // Total yards
  [
    create_team_yards_regex('1ST_HALF_TOTAL_YARDS_-_O\\/U'),
    team_game_market_types.GAME_TEAM_FIRST_HALF_TOTAL_YARDS
  ],
  [
    create_team_yards_regex('1ST_HALF_ALT_TOTAL_YARDS'),
    team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_TOTAL_YARDS
  ],
  // Rushing yards
  [
    create_team_yards_regex('1ST_HALF_TOTAL_RUSHING_YARDS_-_O\\/U'),
    team_game_market_types.GAME_TEAM_FIRST_HALF_RUSHING_YARDS
  ],
  [
    create_team_yards_regex('1ST_HALF_ALT_TOTAL_RUSHING_YARDS'),
    team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_RUSHING_YARDS
  ],
  // Receiving yards
  [
    create_team_yards_regex('1ST_HALF_TOTAL_RECEIVING_YARDS_-_O\\/U'),
    team_game_market_types.GAME_TEAM_FIRST_HALF_RECEIVING_YARDS
  ],
  [
    create_team_yards_regex('1ST_HALF_ALT_TOTAL_RECEIVING_YARDS'),
    team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_RECEIVING_YARDS
  ],

  // === First Quarter ===
  // Rushing yards
  [
    create_team_yards_regex('1ST_QUARTER_TOTAL_RUSHING_YARDS_-_O\\/U'),
    team_game_market_types.GAME_TEAM_FIRST_QUARTER_RUSHING_YARDS
  ],
  [
    create_team_yards_regex('1ST_QUARTER_ALT_TOTAL_RUSHING_YARDS'),
    team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_RUSHING_YARDS
  ],
  // Receiving yards
  [
    create_team_yards_regex('1ST_QUARTER_TOTAL_RECEIVING_YARDS_-_O\\/U'),
    team_game_market_types.GAME_TEAM_FIRST_QUARTER_RECEIVING_YARDS
  ],
  [
    create_team_yards_regex('1ST_QUARTER_ALT_TOTAL_RECEIVING_YARDS'),
    team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_RECEIVING_YARDS
  ],
  // Total yards (alt only)
  [
    create_team_yards_regex('1ST_QUARTER_ALT_TOTAL_YARDS'),
    team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_TOTAL_YARDS
  ]
]

// Combine alt_line_markets and markets
const combined_markets = [
  ...player_game_alt_line_markets,
  ...player_game_markets,
  ...team_game_markets,
  ...team_yardage_markets
]

export const get_market_type_for_quarterback_season_props = ({
  marketName
}) => {
  const market_name_lower = marketName.toLowerCase()
  let is_playoffs = false

  if (market_name_lower.includes('playoff')) {
    is_playoffs = true
  }

  if (
    market_name_lower.includes('passing tds') ||
    market_name_lower.includes('passing touchdowns')
  ) {
    return is_playoffs
      ? player_prop_types.PLAYOFF_PASSING_TOUCHDOWNS
      : player_prop_types.SEASON_PASSING_TOUCHDOWNS
  }

  if (market_name_lower.includes('passing yards')) {
    return is_playoffs
      ? player_prop_types.PLAYOFF_PASSING_YARDS
      : player_prop_types.SEASON_PASSING_YARDS
  }

  return null
}

export const get_market_type_for_wide_receiver_season_props = ({
  marketName
}) => {
  const market_name_lower = marketName.toLowerCase()
  let is_playoffs = false

  if (market_name_lower.includes('playoff')) {
    is_playoffs = true
  }

  if (market_name_lower.includes('receiving yards')) {
    return is_playoffs
      ? player_prop_types.PLAYOFF_RECEIVING_YARDS
      : player_prop_types.SEASON_RECEIVING_YARDS
  }

  if (
    market_name_lower.includes('receiving tds') ||
    market_name_lower.includes('receiving touchdowns')
  ) {
    return is_playoffs
      ? player_prop_types.PLAYOFF_RECEIVING_TOUCHDOWNS
      : player_prop_types.SEASON_RECEIVING_TOUCHDOWNS
  }

  if (market_name_lower.includes('receptions')) {
    return is_playoffs
      ? player_prop_types.PLAYOFF_RECEPTIONS
      : player_prop_types.SEASON_RECEPTIONS
  }

  return null
}

export const get_market_type_for_running_back_season_props = ({
  marketName
}) => {
  const market_name_lower = marketName.toLowerCase()
  let is_playoffs = false

  if (market_name_lower.includes('playoff')) {
    is_playoffs = true
  }

  if (market_name_lower.includes('rushing yards')) {
    return is_playoffs
      ? player_prop_types.PLAYOFF_RUSHING_YARDS
      : player_prop_types.SEASON_RUSHING_YARDS
  }

  if (
    market_name_lower.includes('rushing tds') ||
    market_name_lower.includes('rushing touchdowns')
  ) {
    return is_playoffs
      ? player_prop_types.PLAYOFF_RUSHING_TOUCHDOWNS
      : player_prop_types.SEASON_RUSHING_TOUCHDOWNS
  }

  return null
}

export const get_market_type_for_most_rushing_yards = ({ marketName }) => {
  const market_name_lower = marketName.toLowerCase()

  if (market_name_lower.includes('afc') || market_name_lower.includes('nfc')) {
    return null
  }

  if (market_name_lower.includes('regular season')) {
    return player_prop_types.SEASON_LEADER_RUSHING_YARDS
  }

  return null
}

export const get_market_type = ({ marketType, marketName }) => {
  for (const [regex, prop_type] of combined_markets) {
    if (regex.test(marketType)) {
      return prop_type
    }
  }

  switch (marketType) {
    case 'REGULAR_SEASON_PROPS_-_QUARTERBACKS':
    case 'QUARTERBACK_REGULAR_SEASON_PROPS':
      return get_market_type_for_quarterback_season_props({ marketName })

    case 'REGULAR_SEASON_PROPS_-_WIDE_RECEIVERS':
    case 'WIDE_RECEIVER_REGULAR_SEASON_PROPS':
      return get_market_type_for_wide_receiver_season_props({ marketName })

    case 'REGULAR_SEASON_PROPS_-_RUNNING_BACKS':
    case 'RUNNING_BACK_REGULAR_SEASON_PROPS':
      return get_market_type_for_running_back_season_props({ marketName })

    case 'MOST_RUSHING_YARDS':
      return get_market_type_for_most_rushing_yards({ marketName })
  }

  return null
}

// A season in a page-level market name appears either as a "2024-25" span or as
// a bare four-digit year, and it CANNOT be read as the first four-digit run in
// the string. These names lead with a yardage or odds threshold, so "1000+
// Regular Season Receiving Yards 2024-25" yields 1000 and "Thanksgiving Day
// Specials: +2000 to +4900" yields 2000. That shape wrote FanDuel futures rows
// carrying a season of 1000, 1250, 1500, 1900, 2000, 4000, 4500 or 5000 before
// it was found on 2026-08-23; every one had no esbid, so nothing joining
// nfl_games could contradict it. Repaired in
// db/adhoc/2026-08-23-repair-fanduel-threshold-season-years.sql.
//
// Prefer the span, which is unambiguous. Otherwise take the first four-digit run
// that is not part of a THRESHOLD. Classifying the benign class out by shape
// beats guessing a plausible year window: a window wide enough to admit real
// seasons still admits "+2000", which is the exact value that got through.
//
// A THRESHOLD IS NOT ONLY A '+' TOKEN, and reading it that way is what the first
// fix got wrong. Scoring the shipped parser over all 3,994 distinct FanDuel
// futures names on 2026-08-23 found five it still misread, none of them carrying
// a '+' anywhere near the number: "Any Player to Break the Record for Most
// Passing Yards in the Regular Season (Over 5477.5 Reg season Pass Yards)" gave
// 5477, its rushing and receiving siblings gave 2105 and 1964, and "<player> to
// have 75+ Receptions & 1000 Yards Receiving Yards" gave 1000 for two players --
// there the '+' sits on the RECEPTIONS count, not on the yardage that follows it.
// So the four shapes below are all threshold spellings this vocabulary actually
// uses: an adjacent '+', a decimal fraction (a season is never written "2024.5"),
// an explicit over/under comparator, and a unit noun immediately after the
// number. Together they take the five to null and leave all 349 genuine bare
// years standing.
const SEASON_SPAN_PATTERN = /\b(\d{4})-\d{2}\b/
const FOUR_DIGIT_PATTERN = /\b\d{4}\b/g

// Kept separate from the '+' tests below rather than folded in as an
// alternation: '+' is a non-word character, so a trailing \b after it fails
// against the space in "4000+ Passing Yards" and silently disarms the very check
// the first fix added. Caught by scoring the parser over the whole corpus.
const THRESHOLD_UNIT_NOUNS =
  /^\s*(?:yards|yds|receptions|receiving|rushing|passing|points|pts|tds|touchdowns)\b/i

const THRESHOLD_COMPARATORS =
  /\b(?:over|under|at least|more than|fewer than)\s+$/i

const is_threshold_token = ({ market_name, index, length }) => {
  const before = market_name.slice(0, index)
  const after = market_name.slice(index + length)

  return (
    /\+\s*$/.test(before) ||
    /^\s*\+/.test(after) ||
    // A decimal fraction: the number is a betting line, not a year.
    /^\.\d/.test(after) ||
    // An explicit comparator introduces a line on either side of the number.
    THRESHOLD_COMPARATORS.test(before) ||
    THRESHOLD_UNIT_NOUNS.test(after)
  )
}

export const get_market_year = ({ marketName, source_event_name }) => {
  if (source_event_name) {
    // TODO use source_event_name and event start date to match a game
    return null
  }

  const span_match = marketName.match(SEASON_SPAN_PATTERN)
  if (span_match) {
    return Number(span_match[1])
  }

  for (const match of marketName.matchAll(FOUR_DIGIT_PATTERN)) {
    if (
      is_threshold_token({
        market_name: marketName,
        index: match.index,
        length: match[0].length
      })
    ) {
      continue
    }
    return Number(match[0])
  }

  // No year found in marketName
  return null
}
