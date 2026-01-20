/**
 * Market data handlers for worker threads
 * These handlers process market calculations using preloaded data without database connections
 */

import {
  HANDLER_TYPES,
  market_type_mappings
} from '../market-type-mappings.mjs'
import {
  calculate_metric_value,
  determine_selection_result,
  group_by_game,
  create_dual_result_objects
} from '../prop-market-utils.mjs'

/**
 * Base class for market data handlers
 * Provides common functionality for processing market calculations without database access
 */
class MarketDataHandler {
  constructor(data, handler_type) {
    this.handler_type = handler_type
    this.data_by_game = group_by_game(data)
  }

  /**
   * Create error results for both OPEN and CLOSE time types
   * @param {Object} market - Market object
   * @param {string} error_message - Error description
   * @returns {Array<Object>} Array with OPEN and CLOSE error result objects
   */
  _create_error_results(market, error_message) {
    return create_dual_result_objects({
      market,
      metric_value: null,
      selection_result: null,
      handler_type: this.handler_type,
      error: error_message
    })
  }

  /**
   * Create success results for both OPEN and CLOSE time types
   * @param {Object} market - Market object
   * @param {number} metric_value - Calculated metric value
   * @param {string} selection_result - WON/LOST result
   * @returns {Array<Object>} Array with OPEN and CLOSE success result objects
   */
  _create_success_results(market, metric_value, selection_result) {
    return create_dual_result_objects({
      market,
      metric_value,
      selection_result,
      handler_type: this.handler_type
    })
  }

  /**
   * Get market mapping configuration
   * @param {Object} market - Market object
   * @returns {Object} Market mapping configuration
   */
  _get_market_mapping(market) {
    return market.mapping || market_type_mappings[market.market_type]
  }
}

/**
 * Player Gamelog Market Handler
 * Processes player performance markets using preloaded gamelog data
 */
export class PlayerGamelogMarketHandler extends MarketDataHandler {
  constructor(player_gamelogs) {
    super(player_gamelogs, HANDLER_TYPES.PLAYER_GAMELOG)
  }

  /**
   * Process a batch of markets using player gamelog data
   * @param {Array<Object>} markets - Array of market objects to process
   * @returns {Promise<Array<Object>>} Array of result objects for both OPEN and CLOSE
   */
  async batch_calculate(markets) {
    const all_results = []

    for (const market of markets) {
      try {
        const results = this._process_single_market(market)
        all_results.push(...results)
      } catch (error) {
        const error_results = this._create_error_results(market, error.message)
        all_results.push(...error_results)
      }
    }

    return all_results
  }

  /**
   * Process a single market using player gamelog data
   * @param {Object} market - Market object to process
   * @returns {Array<Object>} Array with OPEN and CLOSE result objects
   */
  _process_single_market(market) {
    const mapping = this._get_market_mapping(market)
    const game_gamelogs = this.data_by_game[market.esbid] || []
    const player_gamelog = this._find_player_gamelog(
      game_gamelogs,
      market.selection_pid
    )

    if (!player_gamelog) {
      const error_message = `No gamelog found for player ${market.selection_pid} in game ${market.esbid}`
      return this._create_error_results(market, error_message)
    }

    const metric_value = calculate_metric_value(player_gamelog, mapping)
    const selection_result = determine_selection_result({
      metric_value,
      selection_type: market.selection_type,
      selection_metric_line: market.selection_metric_line,
      mapping
    })

    return this._create_success_results(market, metric_value, selection_result)
  }

  /**
   * Find gamelog for specific player in game data
   * @param {Array<Object>} game_gamelogs - Array of gamelogs for a specific game
   * @param {string} player_id - Player ID to find
   * @returns {Object|null} Player gamelog or null if not found
   */
  _find_player_gamelog(game_gamelogs, player_id) {
    return game_gamelogs.find((gamelog) => gamelog.pid === player_id) || null
  }
}

/**
 * NFL Plays Market Handler
 * Processes play-by-play markets using preloaded NFL plays data
 */
export class NFLPlaysMarketHandler extends MarketDataHandler {
  constructor(nfl_plays) {
    super(nfl_plays, HANDLER_TYPES.NFL_PLAYS)
  }

  /**
   * Process a batch of markets using NFL plays data
   * @param {Array<Object>} markets - Array of market objects to process
   * @returns {Promise<Array<Object>>} Array of result objects for both OPEN and CLOSE
   */
  async batch_calculate(markets) {
    const all_results = []

    for (const market of markets) {
      try {
        const results = this._process_single_market(market)
        all_results.push(...results)
      } catch (error) {
        const error_results = this._create_error_results(market, error.message)
        all_results.push(...error_results)
      }
    }

    return all_results
  }

  /**
   * Process a single market using NFL plays data
   * @param {Object} market - Market object to process
   * @returns {Array<Object>} Array with OPEN and CLOSE result objects
   */
  _process_single_market(market) {
    const mapping = this._get_market_mapping(market)
    const game_plays = this.data_by_game[market.esbid] || []

    let metric_value
    if (mapping.special_logic === 'first_touchdown_scorer') {
      // For first touchdown scorer, find the first TD in the entire game
      const first_td_play = game_plays.find((play) => {
        const value = play[mapping.metric_columns[0]]
        return value === true
      })

      if (!first_td_play) {
        metric_value = 0 // No touchdowns in the game
      } else {
        // Check if this player scored the first TD
        // For rushing TDs: bc_pid is the scorer
        // For passing TDs: trg_pid is the scorer (receiver)
        // TODO: Use td_pid field once it's available in nfl_plays table
        let is_scorer = false

        if (first_td_play.rush === true) {
          // Rushing TD - bc_pid is the scorer
          is_scorer = first_td_play.bc_pid === market.selection_pid
        } else if (first_td_play.pass === true) {
          // Passing TD - trg_pid is the scorer (receiver)
          is_scorer = first_td_play.trg_pid === market.selection_pid
        } else {
          // Other types of TDs - check both fields as fallback
          is_scorer =
            first_td_play.bc_pid === market.selection_pid ||
            first_td_play.trg_pid === market.selection_pid
        }

        metric_value = is_scorer ? 1 : 0
      }
    } else {
      const relevant_plays = this._filter_plays_for_market(
        game_plays,
        market,
        mapping
      )
      metric_value = this._calculate_plays_metric(
        relevant_plays,
        mapping,
        market
      )
    }
    const selection_result = determine_selection_result({
      metric_value,
      selection_type: market.selection_type,
      selection_metric_line: market.selection_metric_line,
      mapping
    })

    return this._create_success_results(market, metric_value, selection_result)
  }

  /**
   * Filter plays based on market requirements (player, team, quarter, etc.)
   * @param {Array<Object>} game_plays - All plays for a specific game
   * @param {Object} market - Market object containing selection criteria
   * @param {Object} mapping - Market mapping configuration
   * @returns {Array<Object>} Filtered plays relevant to the market
   */
  _filter_plays_for_market(game_plays, market, mapping) {
    if (!game_plays) {
      return []
    }

    // For team aggregate markets, filter by offensive team
    if (mapping.team_aggregate) {
      if (!market.selection_pid) {
        return []
      }
      let filtered_plays = game_plays.filter(
        (play) => play.off === market.selection_pid
      )

      // Apply quarter filter if specified
      if (mapping.quarter_filter) {
        filtered_plays = filtered_plays.filter(
          (play) => play.qtr === mapping.quarter_filter
        )
      }

      // Apply half filter if specified
      if (mapping.half_filter) {
        if (mapping.half_filter === 1) {
          filtered_plays = filtered_plays.filter(
            (play) => play.qtr === 1 || play.qtr === 2
          )
        } else if (mapping.half_filter === 2) {
          filtered_plays = filtered_plays.filter(
            (play) => play.qtr === 3 || play.qtr === 4
          )
        }
      }

      return filtered_plays
    }

    // For player markets, require player_column
    if (!mapping.player_column) {
      return game_plays
    }

    let filtered_plays = game_plays

    // Filter by player if specified
    if (market.selection_pid) {
      filtered_plays = filtered_plays.filter(
        (play) => play[mapping.player_column] === market.selection_pid
      )
    }

    // Filter by quarter if specified
    if (mapping.quarter_filter) {
      filtered_plays = filtered_plays.filter(
        (play) => play.qtr === mapping.quarter_filter
      )
    }

    // Filter by half if specified (first half = quarters 1 and 2)
    if (mapping.half_filter) {
      if (mapping.half_filter === 1) {
        // First half: quarters 1 and 2
        filtered_plays = filtered_plays.filter(
          (play) => play.qtr === 1 || play.qtr === 2
        )
      } else if (mapping.half_filter === 2) {
        // Second half: quarters 3 and 4
        filtered_plays = filtered_plays.filter(
          (play) => play.qtr === 3 || play.qtr === 4
        )
      }
    }

    // Filter out plays with null/undefined metric values
    if (mapping.metric_columns && mapping.metric_columns.length > 0) {
      const primary_metric_column = mapping.metric_columns[0]
      filtered_plays = filtered_plays.filter((play) => {
        const value = play[primary_metric_column]
        return value !== null && value !== undefined
      })
    }

    return filtered_plays
  }

  /**
   * Calculate metric value from filtered plays based on aggregation type
   * @param {Array<Object>} plays - Filtered plays to calculate from
   * @param {Object} mapping - Market mapping configuration
   * @param {Object} market - Market data (needed for first_touchdown_scorer logic)
   * @returns {number} Calculated metric value
   */
  _calculate_plays_metric(plays, mapping, market = null) {
    if (mapping.special_logic === 'count_receptions') {
      // Count receptions by counting completed passes (comp = true)
      return plays.filter((play) => {
        const value = play[mapping.metric_columns[0]]
        return value === true
      }).length
    } else if (mapping.special_logic === 'count_attempts') {
      // Count attempts by counting plays where the metric is true
      return plays.filter((play) => {
        const value = play[mapping.metric_columns[0]]
        return value === true
      }).length
    } else if (mapping.special_logic === 'first_touchdown_scorer') {
      // For first touchdown scorer, we need to check ALL plays in the game, not just filtered ones
      // This logic should be handled at a higher level since we need access to all game plays
      // For now, return 0 and handle this in the main processing logic
      return 0
    } else if (mapping.aggregation_type === 'MAX') {
      const values = plays.map((play) => calculate_metric_value(play, mapping))
      return values.length > 0 ? Math.max(...values) : 0
    } else {
      // Default to sum aggregation
      let total = 0
      for (const play of plays) {
        total += calculate_metric_value(play, mapping) || 0
      }
      return total
    }
  }
}

/**
 * NFL Games Market Handler
 * Processes game-level markets using preloaded NFL games data
 */
export class NFLGamesMarketHandler {
  constructor(nfl_games) {
    this.handler_type = HANDLER_TYPES.NFL_GAMES
    this.games_by_id = this._index_games_by_id(nfl_games)
  }

  /**
   * Process a batch of markets using NFL games data
   * @param {Array<Object>} markets - Array of market objects to process
   * @returns {Promise<Array<Object>>} Array of result objects for both OPEN and CLOSE
   */
  async batch_calculate(markets) {
    const all_results = []

    for (const market of markets) {
      try {
        const results = this._process_single_market(market)
        all_results.push(...results)
      } catch (error) {
        const error_results = this._create_error_results(market, error.message)
        all_results.push(...error_results)
      }
    }

    return all_results
  }

  /**
   * Process a single market using NFL games data
   * @param {Object} market - Market object to process
   * @returns {Array<Object>} Array with OPEN and CLOSE result objects
   */
  _process_single_market(market) {
    const mapping = this._get_market_mapping(market)
    const game = this.games_by_id[market.esbid]

    if (!game) {
      const error_message = `No game data found for esbid ${market.esbid}`
      return this._create_error_results(market, error_message)
    }

    // Handle calculation_type based markets (spread, total, moneyline)
    if (mapping.calculation_type) {
      return this._process_game_outcome_market({ market, game, mapping })
    }

    // Standard metric-based markets
    const metric_value = calculate_metric_value(game, mapping)
    const selection_result = determine_selection_result({
      metric_value,
      selection_type: market.selection_type,
      selection_metric_line: market.selection_metric_line,
      mapping
    })

    return this._create_success_results(market, metric_value, selection_result)
  }

  /**
   * Validate team selection against game participants
   * @param {string} selection_pid - Selected team ID
   * @param {Object} game - Game data with h (home) and v (visitor) team codes
   * @returns {{ is_home_team: boolean }|null} Team info or null if not found
   */
  _validate_team_selection(selection_pid, game) {
    if (selection_pid === game.h) {
      return { is_home_team: true }
    }
    if (selection_pid === game.v) {
      return { is_home_team: false }
    }
    return null
  }

  /**
   * Process game outcome markets (spread, total, moneyline)
   * @param {Object} params - Named parameters
   * @param {Object} params.market - Market object
   * @param {Object} params.game - Game data with h, v, home_score, away_score
   * @param {Object} params.mapping - Market mapping configuration
   * @returns {Array<Object>} Array with OPEN and CLOSE result objects
   */
  _process_game_outcome_market({ market, game, mapping }) {
    const { calculation_type } = mapping

    switch (calculation_type) {
      case 'total_points': {
        // Use centralized calculation which handles validation
        const total_points = calculate_metric_value(game, mapping)
        if (total_points === null) {
          return this._create_error_results(market, 'Missing score data')
        }
        const selection_result = determine_selection_result({
          metric_value: total_points,
          selection_type: market.selection_type,
          selection_metric_line: market.selection_metric_line,
          mapping
        })
        return this._create_success_results(
          market,
          total_points,
          selection_result
        )
      }

      case 'point_differential_vs_spread': {
        const team_info = this._validate_team_selection(
          market.selection_pid,
          game
        )
        if (!team_info) {
          return this._create_error_results(
            market,
            `Selection ${market.selection_pid} not found in game (h: ${game.h}, v: ${game.v})`
          )
        }

        // Get home perspective differential using centralized calculation
        const home_diff = calculate_metric_value(game, mapping)
        if (home_diff === null) {
          return this._create_error_results(market, 'Missing score data')
        }

        // Adjust for selected team's perspective
        const point_differential = team_info.is_home_team
          ? home_diff
          : -home_diff

        const selection_result = determine_selection_result({
          metric_value: point_differential,
          selection_type: market.selection_type,
          selection_metric_line: market.selection_metric_line,
          mapping
        })
        return this._create_success_results(
          market,
          point_differential,
          selection_result
        )
      }

      case 'winner_determination': {
        const team_info = this._validate_team_selection(
          market.selection_pid,
          game
        )
        if (!team_info) {
          return this._create_error_results(
            market,
            `Selection ${market.selection_pid} not found in game (h: ${game.h}, v: ${game.v})`
          )
        }

        // Validate scores - check null/undefined first, then convert
        if (game.home_score === null || game.home_score === undefined) {
          return this._create_error_results(market, 'Missing home score data')
        }
        if (game.away_score === null || game.away_score === undefined) {
          return this._create_error_results(market, 'Missing away score data')
        }

        const home_score = Number(game.home_score)
        const away_score = Number(game.away_score)

        if (Number.isNaN(home_score) || Number.isNaN(away_score)) {
          return this._create_error_results(market, 'Invalid score data')
        }

        let selection_result
        if (home_score === away_score) {
          selection_result = 'PUSH'
        } else {
          const home_won = home_score > away_score
          const selected_team_won = team_info.is_home_team
            ? home_won
            : !home_won
          selection_result = selected_team_won ? 'WON' : 'LOST'
        }

        // Score margin from selected team's perspective
        const score_margin = team_info.is_home_team
          ? home_score - away_score
          : away_score - home_score

        return this._create_success_results(
          market,
          score_margin,
          selection_result
        )
      }

      default:
        return this._create_error_results(
          market,
          `Unknown calculation_type: ${calculation_type}`
        )
    }
  }

  /**
   * Create error results for both OPEN and CLOSE time types
   * @param {Object} market - Market object
   * @param {string} error_message - Error description
   * @returns {Array<Object>} Array with OPEN and CLOSE error result objects
   */
  _create_error_results(market, error_message) {
    return create_dual_result_objects({
      market,
      metric_value: null,
      selection_result: null,
      handler_type: this.handler_type,
      error: error_message
    })
  }

  /**
   * Create success results for both OPEN and CLOSE time types
   * @param {Object} market - Market object
   * @param {number} metric_value - Calculated metric value
   * @param {string} selection_result - WON/LOST result
   * @returns {Array<Object>} Array with OPEN and CLOSE success result objects
   */
  _create_success_results(market, metric_value, selection_result) {
    return create_dual_result_objects({
      market,
      metric_value,
      selection_result,
      handler_type: this.handler_type
    })
  }

  /**
   * Get market mapping configuration
   * @param {Object} market - Market object
   * @returns {Object} Market mapping configuration
   */
  _get_market_mapping(market) {
    return market.mapping || market_type_mappings[market.market_type]
  }

  /**
   * Index games by their esbid for fast lookup
   * @param {Array<Object>} games - Array of game objects
   * @returns {Object} Games indexed by esbid
   */
  _index_games_by_id(games) {
    const games_by_id = {}
    for (const game of games) {
      games_by_id[game.esbid] = game
    }
    return games_by_id
  }
}
