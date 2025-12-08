import {
  player_prop_types,
  team_game_market_types
} from '#libs-shared/bookmaker-constants.mjs'

const create_player_regex = (suffix) =>
  new RegExp(`^PLAYER_[A-Z](_-_|_)${suffix}$`)

const alt_quarter_markets = [
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

// Team game market mappings (non-player markets)
const team_game_markets = [
  [/^ALTERNATE_HANDICAP$/, team_game_market_types.GAME_ALT_SPREAD],
  [/^ALTERNATE_TOTAL$/, team_game_market_types.GAME_ALT_TOTAL]
]

// Combine alt_line_markets and markets
const combined_markets = [
  ...player_game_alt_line_markets,
  ...player_game_markets,
  ...team_game_markets
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

export const get_market_year = ({ marketName, source_event_name }) => {
  if (!source_event_name) {
    // likely not a game, check marketName for year
    const match = marketName.match(/(\d{4})/)
    if (match) {
      return Number(match[1])
    }
    // No year found in marketName
    return null
  }

  // TODO use source_event_name and event start date to match a game
  return null
}
