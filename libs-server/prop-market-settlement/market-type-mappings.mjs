import {
  player_game_prop_types,
  player_game_alt_prop_types,
  player_first_quarter_prop_types,
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
export const market_type_mappings = {
  // Player game performance markets - use player_gamelogs
  [player_game_prop_types.GAME_PASSING_YARDS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['py'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_PASSING_COMPLETIONS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['pc'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_PASSING_ATTEMPTS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['pa'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_PASSING_TOUCHDOWNS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['tdp'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_PASSING_INTERCEPTIONS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['ints'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['ry'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_RUSHING_ATTEMPTS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['ra'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_RUSHING_TOUCHDOWNS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['tdr'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['recy'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_RECEPTIONS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['rec'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_RECEIVING_TOUCHDOWNS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['tdrec'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_RECEIVING_TARGETS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['trg'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_DEFENSE_SACKS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['dsk'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_TACKLES_ASSISTS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['dtno'], // defensive tackles + assists
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  // TODO: GAME_TACKLES_FOR_LOSS requires dtfl column to be added to player_gamelogs table
  // Commenting out until database schema is updated
  // [player_game_prop_types.GAME_TACKLES_FOR_LOSS]: {
  //   handler: HANDLER_TYPES.PLAYER_GAMELOG,
  //   metric_columns: ['dtfl'],
  //   has_metric_value: true,
  //   selection_types: ['OVER', 'UNDER']
  // },
  [player_game_prop_types.GAME_FIELD_GOALS_MADE]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['fgm'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  // TODO: GAME_PUNTS requires punts column to be added to player_gamelogs table
  // Commenting out until database schema is updated
  // [player_game_prop_types.GAME_PUNTS]: {
  //   handler: HANDLER_TYPES.PLAYER_GAMELOG,
  //   metric_columns: ['punts'],
  //   has_metric_value: true,
  //   selection_types: ['OVER', 'UNDER']
  // },

  // Combined stat markets
  [player_game_prop_types.GAME_RUSHING_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['ry', 'recy'], // Multiple columns to sum
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_PASSING_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['py', 'ry'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },

  // Anytime touchdown - special handling (based on reference script)
  [player_game_prop_types.ANYTIME_TOUCHDOWN]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['tdr', 'tdrec'], // Only rushing and receiving TDs like reference
    has_metric_value: false, // Just YES/NO
    selection_types: ['YES', 'NO'],
    special_logic: 'anytime_touchdown'
  },

  // First touchdown scorer - find first TD in game using NFL plays
  // TODO: Use td_pid field once it's available in nfl_plays table
  [player_game_prop_types.GAME_FIRST_TOUCHDOWN_SCORER]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    metric_columns: ['td'], // touchdown indicator
    has_metric_value: false, // Just YES/NO
    selection_types: ['YES', 'NO'],
    special_logic: 'first_touchdown_scorer'
  },

  // Two or more touchdowns - count total TDs from player gamelog
  [player_game_prop_types.GAME_TWO_PLUS_TOUCHDOWNS]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['tdr', 'tdrec'], // rushing and receiving TDs
    has_metric_value: false, // Just YES/NO
    selection_types: ['YES', 'NO'],
    special_logic: 'two_plus_touchdowns'
  },

  // First quarter markets - use NFL plays data (based on reference script logic)
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_PASSING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'psr_pid',
    metric_columns: ['pass_yds'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER'],
    quarter_filter: 1
  },
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'bc_pid', // ball carrier
    metric_columns: ['rush_yds'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER'],
    quarter_filter: 1
  },
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'trg_pid', // target
    metric_columns: ['recv_yds'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER'],
    quarter_filter: 1
  },
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_RECEPTIONS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'trg_pid', // target
    metric_columns: ['comp'], // Count receptions by counting completed passes
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER'],
    quarter_filter: 1,
    special_logic: 'count_receptions'
  },
  [player_first_quarter_prop_types.GAME_FIRST_QUARTER_RUSHING_ATTEMPTS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'bc_pid', // ball carrier
    metric_columns: ['rush'], // Count rushing attempts by counting rush plays
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER'],
    quarter_filter: 1,
    special_logic: 'count_attempts'
  },

  // First half markets - use NFL plays data for quarters 1 and 2
  [player_first_half_alt_prop_types.GAME_FIRST_HALF_ALT_RUSHING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'bc_pid', // ball carrier
    metric_columns: ['rush_yds'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER'],
    half_filter: 1 // First half (quarters 1 and 2)
  },
  [player_first_half_alt_prop_types.GAME_FIRST_HALF_ALT_PASSING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'psr_pid', // passer
    metric_columns: ['pass_yds'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER'],
    half_filter: 1 // First half (quarters 1 and 2)
  },
  [player_first_half_alt_prop_types.GAME_FIRST_HALF_ALT_RECEIVING_YARDS]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'trg_pid', // target
    metric_columns: ['recv_yds'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER'],
    half_filter: 1 // First half (quarters 1 and 2)
  },

  // Longest play markets - use player gamelogs data
  [player_game_prop_types.GAME_LONGEST_RECEPTION]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['longest_reception'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_LONGEST_RUSH]: {
    handler: HANDLER_TYPES.PLAYER_GAMELOG,
    metric_columns: ['longest_rush'],
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },
  [player_game_prop_types.GAME_PASSING_LONGEST_COMPLETION]: {
    handler: HANDLER_TYPES.NFL_PLAYS,
    player_column: 'psr_pid',
    metric_columns: ['pass_yds'],
    aggregation_type: 'MAX',
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },

  // Game outcome markets - use NFL games data
  [team_game_market_types.GAME_MONEYLINE]: {
    handler: HANDLER_TYPES.NFL_GAMES,
    calculation_type: 'winner_determination',
    has_metric_value: false,
    selection_types: ['team_id']
  },
  [team_game_market_types.GAME_SPREAD]: {
    handler: HANDLER_TYPES.NFL_GAMES,
    calculation_type: 'point_differential_vs_spread',
    has_metric_value: true,
    selection_types: ['team_id']
  },
  [team_game_market_types.GAME_TOTAL]: {
    handler: HANDLER_TYPES.NFL_GAMES,
    calculation_type: 'total_points',
    has_metric_value: true,
    selection_types: ['OVER', 'UNDER']
  },

  // Awards and season-long markets - unsupported (require external data)
  ...Object.fromEntries(
    Object.values(awards_prop_types).map((type) => [
      type,
      {
        handler: HANDLER_TYPES.UNSUPPORTED,
        reason: 'Requires external award voting data'
      }
    ])
  ),

  ...Object.fromEntries(
    Object.values(player_season_prop_types).map((type) => [
      type,
      {
        handler: HANDLER_TYPES.UNSUPPORTED,
        reason: 'Season totals require aggregation across multiple games'
      }
    ])
  ),

  ...Object.fromEntries(
    Object.values(futures_types).map((type) => [
      type,
      {
        handler: HANDLER_TYPES.UNSUPPORTED,
        reason: 'Futures markets require season-end determination'
      }
    ])
  ),

  ...Object.fromEntries(
    Object.values(team_season_types).map((type) => [
      type,
      {
        handler: HANDLER_TYPES.UNSUPPORTED,
        reason: 'Team season markets require season-end aggregation'
      }
    ])
  )
}

// Add alt line markets after base markets are defined
const alt_line_mappings = {}

// Map alt line markets to their base counterparts
Object.entries(player_game_alt_prop_types).forEach(([key, value]) => {
  const base_type = key.replace('_ALT_', '_')
  const base_mapping = market_type_mappings[player_game_prop_types[base_type]]
  if (base_mapping && base_mapping.handler !== HANDLER_TYPES.UNSUPPORTED) {
    alt_line_mappings[value] = { ...base_mapping, is_alt_line: true }
  }
})

// Add alt quarter mappings
Object.entries(player_quarter_alt_prop_types).forEach(([key, value]) => {
  const base_type = key.replace('_ALT_', '_')
  const base_mapping =
    market_type_mappings[player_first_quarter_prop_types[base_type]]
  if (base_mapping && base_mapping.handler !== HANDLER_TYPES.UNSUPPORTED) {
    alt_line_mappings[value] = { ...base_mapping, is_alt_line: true }
  }
})

// Add alt half mappings
Object.entries(player_first_half_alt_prop_types).forEach(([key, value]) => {
  const base_type = key.replace('_ALT_', '_')
  const base_mapping =
    market_type_mappings[player_first_half_alt_prop_types[base_type]]
  if (base_mapping && base_mapping.handler !== HANDLER_TYPES.UNSUPPORTED) {
    alt_line_mappings[value] = { ...base_mapping, is_alt_line: true }
  }
})

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
