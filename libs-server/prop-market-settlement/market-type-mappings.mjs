import {
  player_game_prop_types,
  player_game_alt_prop_types,
  player_first_quarter_prop_types,
  player_second_quarter_prop_types,
  player_third_quarter_prop_types,
  player_fourth_quarter_prop_types,
  player_quarter_alt_prop_types,
  player_first_half_alt_prop_types,
  team_game_market_types,
  player_season_prop_types,
  awards_prop_types,
  futures_types,
  team_season_types
} from '#libs-shared/bookmaker-constants.mjs'

// Handler types
export const HANDLER_TYPES = {
  PLAYER_GAMELOG: 'PLAYER_GAMELOG',
  NFL_PLAYS: 'NFL_PLAYS',
  NFL_GAMES: 'NFL_GAMES',
  UNSUPPORTED: 'UNSUPPORTED'
}

// Market type to calculator mappings
//
// A market type absent from this object resolves to UNSUPPORTED and is never
// settled, which is the correct state for any market whose result cannot be
// derived exactly from the preloaded data. Never map a market onto an
// approximate or adjacent column to gain coverage: an unsettled market is
// visible, a wrongly settled one is not.
export const market_type_mappings = {
  // Player game performance markets - use player_gamelogs
  [player_game_prop_types.GAME_PASSING_YARDS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['passing_yards']
  },
  [player_game_prop_types.GAME_PASSING_COMPLETIONS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['passing_completions']
  },
  [player_game_prop_types.GAME_PASSING_ATTEMPTS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['passing_attempts']
  },
  [player_game_prop_types.GAME_PASSING_TOUCHDOWNS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['passing_touchdowns']
  },
  [player_game_prop_types.GAME_PASSING_INTERCEPTIONS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['passing_interceptions']
  },
  [player_game_prop_types.GAME_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['rushing_yards']
  },
  [player_game_prop_types.GAME_RUSHING_ATTEMPTS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['rushing_attempts']
  },
  [player_game_prop_types.GAME_RUSHING_TOUCHDOWNS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['rushing_touchdowns']
  },
  [player_game_prop_types.GAME_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['receiving_yards']
  },
  [player_game_prop_types.GAME_RECEPTIONS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['receptions']
  },
  [player_game_prop_types.GAME_RECEIVING_TOUCHDOWNS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['receiving_touchdowns']
  },
  [player_game_prop_types.GAME_RECEIVING_TARGETS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['targets']
  },
  [player_game_prop_types.GAME_DEFENSE_SACKS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['defensive_sacks']
  },
  // GAME_TACKLES_ASSISTS, GAME_TACKLES_FOR_LOSS and GAME_PUNTS are deliberately
  // unmapped: player_gamelogs carries no tackle, tackle-for-loss or punt
  // column, and the per-play tackler columns in nfl_plays would need a handler
  // that counts player id appearances across several columns rather than
  // summing a metric. Map them only once such a column or handler exists.
  [player_game_prop_types.GAME_FIELD_GOALS_MADE]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['field_goals_made']
  },

  // Combined stat markets
  [player_game_prop_types.GAME_RUSHING_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['rushing_yards', 'receiving_yards'] // Multiple columns to sum
  },
  [player_game_prop_types.GAME_PASSING_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['passing_yards', 'rushing_yards']
  },

  // Anytime touchdown - any touchdown the player scores counts, which is every
  // touchdown column except passing_touchdowns (credited to the thrower, not
  // the scorer)
  [player_game_prop_types.ANYTIME_TOUCHDOWN]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: [
      'rushing_touchdowns',
      'receiving_touchdowns',
      'punt_return_touchdowns',
      'kickoff_return_touchdowns',
      'fumble_return_touchdowns'
    ],
    special_logic: 'anytime_touchdown'
  },

  // First touchdown scorer - find first TD in game using NFL plays
  // TODO: Use td_pid field once it's available in nfl_plays table
  [player_game_prop_types.GAME_FIRST_TOUCHDOWN_SCORER]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['is_touchdown'], // touchdown indicator
    special_logic: 'first_touchdown_scorer'
  },

  // Two or more touchdowns - same scorer columns as ANYTIME_TOUCHDOWN
  [player_game_prop_types.GAME_TWO_PLUS_TOUCHDOWNS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: [
      'rushing_touchdowns',
      'receiving_touchdowns',
      'punt_return_touchdowns',
      'kickoff_return_touchdowns',
      'fumble_return_touchdowns'
    ],
    special_logic: 'two_plus_touchdowns'
  },

  // Quarter and half markets - use NFL plays data.
  //
  // Each mapping selects plays through a SINGLE player_column, so a market
  // combining two player roles (passing + rushing, rushing + receiving) cannot
  // be expressed here: the filter would keep only the plays of one role and
  // the other component would always be zero. Those quarter market types are
  // therefore left unmapped for every quarter until the NFL_PLAYS handler can
  // union plays across roles.

  // First quarter markets
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_PASSING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'passer_pid',
    metric_columns: ['pass_yards'],
    quarter_filter: 1
  },
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'ball_carrier_pid', // ball carrier
    metric_columns: ['rush_yards'],
    quarter_filter: 1
  },
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'target_pid', // target
    metric_columns: ['receiving_yards'],
    quarter_filter: 1
  },
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_RECEPTIONS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'target_pid', // target
    metric_columns: ['is_completion'], // Count receptions by counting completed passes
    quarter_filter: 1,
    special_logic: 'count_receptions'
  },
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_RUSHING_ATTEMPTS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'ball_carrier_pid', // ball carrier
    metric_columns: ['is_rushing_play'], // Count rushing attempts by counting rush plays
    quarter_filter: 1,
    special_logic: 'count_attempts'
  },
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_PASSING_ATTEMPTS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'passer_pid', // passer
    metric_columns: ['is_passing_play'], // Count passing attempts by counting pass plays
    quarter_filter: 1,
    special_logic: 'count_attempts'
  },
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_PASSING_INTERCEPTIONS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'passer_pid', // passer
    metric_columns: ['is_interception'], // interception indicator
    quarter_filter: 1,
    special_logic: 'count_attempts'
  },

  // Second quarter markets
  [player_second_quarter_prop_types.GAME_SECOND_QUARTER_PASSING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'passer_pid',
    metric_columns: ['pass_yards'],
    quarter_filter: 2
  },
  [player_second_quarter_prop_types.GAME_SECOND_QUARTER_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'ball_carrier_pid',
    metric_columns: ['rush_yards'],
    quarter_filter: 2
  },
  [player_second_quarter_prop_types.GAME_SECOND_QUARTER_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'target_pid',
    metric_columns: ['receiving_yards'],
    quarter_filter: 2
  },

  // Third quarter markets
  [player_third_quarter_prop_types.GAME_THIRD_QUARTER_PASSING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'passer_pid',
    metric_columns: ['pass_yards'],
    quarter_filter: 3
  },
  [player_third_quarter_prop_types.GAME_THIRD_QUARTER_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'ball_carrier_pid',
    metric_columns: ['rush_yards'],
    quarter_filter: 3
  },
  [player_third_quarter_prop_types.GAME_THIRD_QUARTER_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'target_pid',
    metric_columns: ['receiving_yards'],
    quarter_filter: 3
  },

  // Fourth quarter markets
  [player_fourth_quarter_prop_types.GAME_FOURTH_QUARTER_PASSING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'passer_pid',
    metric_columns: ['pass_yards'],
    quarter_filter: 4
  },
  [player_fourth_quarter_prop_types.GAME_FOURTH_QUARTER_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'ball_carrier_pid',
    metric_columns: ['rush_yards'],
    quarter_filter: 4
  },
  [player_fourth_quarter_prop_types.GAME_FOURTH_QUARTER_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'target_pid',
    metric_columns: ['receiving_yards'],
    quarter_filter: 4
  },

  // First half markets - use NFL plays data for quarters 1 and 2
  [player_first_half_alt_prop_types.GAME_FIRST_HALF_ALT_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'ball_carrier_pid', // ball carrier
    metric_columns: ['rush_yards'],
    half_filter: 1 // First half (quarters 1 and 2)
  },
  [player_first_half_alt_prop_types.GAME_FIRST_HALF_ALT_PASSING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'passer_pid', // passer
    metric_columns: ['pass_yards'],
    half_filter: 1 // First half (quarters 1 and 2)
  },
  [player_first_half_alt_prop_types.GAME_FIRST_HALF_ALT_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'target_pid', // target
    metric_columns: ['receiving_yards'],
    half_filter: 1 // First half (quarters 1 and 2)
  },

  // Longest play markets - use NFL plays data with MAX aggregation
  [player_game_prop_types.GAME_LONGEST_RECEPTION]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'target_pid',
    metric_columns: ['receiving_yards'],
    aggregation_type: 'MAX'
  },
  [player_game_prop_types.GAME_LONGEST_RUSH]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'ball_carrier_pid',
    metric_columns: ['rush_yards'],
    aggregation_type: 'MAX'
  },
  [player_game_prop_types.GAME_PASSING_LONGEST_COMPLETION]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'passer_pid',
    metric_columns: ['pass_yards'],
    aggregation_type: 'MAX'
  },

  // Team yardage markets - full game (use NFL plays data)
  [team_game_market_types.GAME_TEAM_TOTAL_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['rush_yards', 'receiving_yards'],
    team_aggregate: true
  },
  [team_game_market_types.GAME_TEAM_ALT_TOTAL_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['rush_yards', 'receiving_yards'],
    team_aggregate: true
  },
  [team_game_market_types.GAME_TEAM_ALT_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['rush_yards'],
    team_aggregate: true
  },
  [team_game_market_types.GAME_TEAM_ALT_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['receiving_yards'],
    team_aggregate: true
  },

  // Team yardage markets - first half (use NFL plays data)
  [team_game_market_types.GAME_TEAM_FIRST_HALF_TOTAL_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['rush_yards', 'receiving_yards'],
    team_aggregate: true,
    half_filter: 1
  },
  [team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_TOTAL_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['rush_yards', 'receiving_yards'],
    team_aggregate: true,
    half_filter: 1
  },
  [team_game_market_types.GAME_TEAM_FIRST_HALF_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['rush_yards'],
    team_aggregate: true,
    half_filter: 1
  },
  [team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['rush_yards'],
    team_aggregate: true,
    half_filter: 1
  },
  [team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['receiving_yards'],
    team_aggregate: true,
    half_filter: 1
  },

  // Team yardage markets - first quarter (use NFL plays data)
  [team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_TOTAL_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['rush_yards', 'receiving_yards'],
    team_aggregate: true,
    quarter_filter: 1
  },
  [team_game_market_types.GAME_TEAM_FIRST_QUARTER_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['rush_yards'],
    team_aggregate: true,
    quarter_filter: 1
  },
  [team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['rush_yards'],
    team_aggregate: true,
    quarter_filter: 1
  },
  [team_game_market_types.GAME_TEAM_FIRST_QUARTER_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['receiving_yards'],
    team_aggregate: true,
    quarter_filter: 1
  },
  [team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['receiving_yards'],
    team_aggregate: true,
    quarter_filter: 1
  },

  // Game outcome markets - use NFL games data
  [team_game_market_types.GAME_MONEYLINE]: {
    handler: HANDLER_TYPES.NFL_GAMES,
    calculation_type: 'winner_determination'
  },
  [team_game_market_types.GAME_SPREAD]: {
    handler: HANDLER_TYPES.NFL_GAMES,
    calculation_type: 'point_differential_vs_spread'
  },
  [team_game_market_types.GAME_ALT_SPREAD]: {
    handler: HANDLER_TYPES.NFL_GAMES,
    calculation_type: 'point_differential_vs_spread'
  },
  [team_game_market_types.GAME_TOTAL]: {
    handler: HANDLER_TYPES.NFL_GAMES,
    calculation_type: 'total_points'
  },
  [team_game_market_types.GAME_ALT_TOTAL]: {
    handler: HANDLER_TYPES.NFL_GAMES,
    calculation_type: 'total_points'
  },

  // Awards, season-long and futures markets are unsupported: awards need
  // external voting data, player and team season totals need aggregation
  // across games, and futures need season-end determination.
  ...Object.fromEntries(
    [
      awards_prop_types,
      player_season_prop_types,
      futures_types,
      team_season_types
    ].flatMap((prop_types) =>
      Object.values(prop_types).map((type) => [
        type,
        { handler: HANDLER_TYPES.UNSUPPORTED }
      ])
    )
  )
}

// Add alt line markets after base markets are defined. An alt line market
// settles exactly like its base market -- only the offered line differs -- so
// it reuses the base mapping unchanged.
const alt_line_mappings = {}

// Map alt line markets to their base counterparts
Object.entries(player_game_alt_prop_types).forEach(([key, value]) => {
  const base_type = key.replace('_ALT_', '_')
  const base_mapping = market_type_mappings[player_game_prop_types[base_type]]
  if (base_mapping && base_mapping.handler !== HANDLER_TYPES.UNSUPPORTED) {
    alt_line_mappings[value] = base_mapping
  }
})

// Add alt quarter mappings - determine correct quarter constant based on key
const quarter_prop_type_maps = {
  FIRST_QUARTER: player_first_quarter_prop_types,
  SECOND_QUARTER: player_second_quarter_prop_types,
  THIRD_QUARTER: player_third_quarter_prop_types,
  FOURTH_QUARTER: player_fourth_quarter_prop_types
}

Object.entries(player_quarter_alt_prop_types).forEach(([key, value]) => {
  const base_type = key.replace('_ALT_', '_')

  // Determine which quarter constant to use based on the key
  let quarter_prop_types = null
  for (const [quarter_key, prop_types] of Object.entries(
    quarter_prop_type_maps
  )) {
    if (key.includes(quarter_key)) {
      quarter_prop_types = prop_types
      break
    }
  }

  if (!quarter_prop_types) {
    return
  }

  const base_mapping = market_type_mappings[quarter_prop_types[base_type]]
  if (base_mapping && base_mapping.handler !== HANDLER_TYPES.UNSUPPORTED) {
    alt_line_mappings[value] = base_mapping
  }
})

// First half markets need no alt derivation: every first half market type is
// itself an alt type and is mapped directly above.

// Merge alt line mappings into main mappings
Object.assign(market_type_mappings, alt_line_mappings)

// Helper functions
export const get_handler_for_market_type = (market_type) => {
  const mapping = market_type_mappings[market_type]
  return mapping ? mapping.handler : HANDLER_TYPES.UNSUPPORTED
}

export const get_supported_market_types = () => {
  return Object.keys(market_type_mappings).filter(
    (type) => market_type_mappings[type].handler !== HANDLER_TYPES.UNSUPPORTED
  )
}

export const get_unsupported_market_types = () => {
  return Object.keys(market_type_mappings).filter(
    (type) => market_type_mappings[type].handler === HANDLER_TYPES.UNSUPPORTED
  )
}

export const get_market_types_by_data_source = () => {
  const result = {}
  for (const calculator_type of Object.values(HANDLER_TYPES)) {
    result[calculator_type] = []
  }

  for (const [market_type, mapping] of Object.entries(market_type_mappings)) {
    result[mapping.handler].push(market_type)
  }

  return result
}
