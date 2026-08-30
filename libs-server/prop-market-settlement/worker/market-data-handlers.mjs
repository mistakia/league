/**
 * Market data handlers for worker threads
 * These handlers process market calculations using preloaded data without database connections
 */

import {
  HANDLER_TYPES,
  market_type_mappings
} from '#libs-server/prop-market-settlement/market-type-mappings.mjs'
import {
  calculate_metric_value,
  determine_selection_result,
  group_by_game,
  create_selection_result
} from '#libs-server/prop-market-settlement/prop-market-utils.mjs'

/**
 * The player each nfl_plays yardage column is credited to. A play row names
 * three different players, and each yardage column belongs to exactly one of
 * them, so a market combining two columns spans plays that no single
 * player_column selects.
 */
const PLAY_METRIC_PLAYER_COLUMNS = {
  pass_yards: 'passer_pid',
  rush_yards: 'ball_carrier_pid',
  receiving_yards: 'target_pid'
}

/**
 * Base class for market data handlers
 * Provides common functionality for processing market calculations without database access
 */
class MarketDataHandler {
  constructor(handler_type) {
    this.handler_type = handler_type
  }

  /**
   * Process a batch of markets, isolating each market's failure to that market
   * @param {Array<object>} markets - Array of market objects to process
   * @returns {Promise<Array<object>>} Array of result objects for both OPEN and CLOSE
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
   * Create the error result for one selection row
   * @param {object} market - Market object
   * @param {string} error_message - Error description
   * @returns {Array<object>} Array with the error result for this selection row
   */
  _create_error_results(market, error_message) {
    return [
      create_selection_result({
        market,
        metric_value: null,
        selection_result: null,
        handler_type: this.handler_type,
        error: error_message
      })
    ]
  }

  /**
   * Create the success result for one selection row
   * @param {object} market - Market object
   * @param {number} metric_value - Calculated metric value
   * @param {string} selection_result - WON/LOST result
   * @returns {Array<object>} Array with the result for this selection row
   */
  _create_success_results(market, metric_value, selection_result) {
    return [
      create_selection_result({
        market,
        metric_value,
        selection_result,
        handler_type: this.handler_type
      })
    ]
  }

  /**
   * Get market mapping configuration
   * @param {object} market - Market object
   * @returns {object} Market mapping configuration
   * @throws {Error} If the market type has no mapping
   */
  _get_market_mapping(market) {
    const mapping = market.mapping || market_type_mappings[market.market_type]
    if (!mapping) {
      throw new Error(`No mapping for market type ${market.market_type}`)
    }
    return mapping
  }
}

/**
 * Player Gamelog Market Handler
 * Processes player performance markets using preloaded gamelog data
 */
export class PlayerGamelogMarketHandler extends MarketDataHandler {
  constructor(player_gamelogs) {
    super(HANDLER_TYPES.PLAYER_GAMELOG)

    // Every market looks its player up by (game, player), so scanning the
    // game's gamelog array per market is a nested scan over the same
    // collection -- a full slate preloads ~90 gamelogs per game against
    // thousands of markets. Index once at construction and look up in
    // constant time. The key is built with the same template coercion the
    // data_by_game object keys use, so a bigint esbid from prop_markets_index
    // and an integer esbid from player_gamelogs still meet.
    this.gamelog_by_game_and_player = new Map()
    for (const gamelog of player_gamelogs) {
      this.gamelog_by_game_and_player.set(
        `${gamelog.esbid}:${gamelog.pid}`,
        gamelog
      )
    }
  }

  /**
   * Process a single market using player gamelog data
   * @param {object} market - Market object to process
   * @returns {Array<object>} Array with OPEN and CLOSE result objects
   */
  _process_single_market(market) {
    const mapping = this._get_market_mapping(market)
    const player_gamelog = this._find_player_gamelog(
      market.esbid,
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
   * Find the gamelog for one player in one game
   * @param {number|string} esbid - Game ID to look in
   * @param {string} player_id - Player ID to find
   * @returns {object|null} Player gamelog or null if not found
   */
  _find_player_gamelog(esbid, player_id) {
    return this.gamelog_by_game_and_player.get(`${esbid}:${player_id}`) || null
  }
}

/**
 * NFL Plays Market Handler
 * Processes play-by-play markets using preloaded NFL plays data
 */
export class NFLPlaysMarketHandler extends MarketDataHandler {
  constructor(nfl_plays) {
    super(HANDLER_TYPES.NFL_PLAYS)
    this.data_by_game = group_by_game(nfl_plays)
  }

  /**
   * Process a single market using NFL plays data
   * @param {object} market - Market object to process
   * @returns {Array<object>} Array with OPEN and CLOSE result objects
   */
  _process_single_market(market) {
    const mapping = this._get_market_mapping(market)
    const game_plays = this.data_by_game[market.esbid]

    // No preloaded plays means the game was never loaded, not that nothing
    // happened in it. Settling on an empty play set would grade every market
    // in the game against a zero metric as if that were a real outcome.
    if (!game_plays || game_plays.length === 0) {
      return this._create_error_results(
        market,
        `No plays found for game ${market.esbid}`
      )
    }

    let metric_value
    if (mapping.special_logic === 'first_touchdown_scorer') {
      metric_value = this._calculate_first_touchdown_metric({
        game_plays,
        market,
        mapping
      })
    } else if (this._is_combined_player_market(mapping)) {
      metric_value = this._calculate_combined_player_metric({
        game_plays,
        market,
        mapping
      })
    } else {
      const relevant_plays = this._filter_plays_for_market({
        game_plays,
        market,
        mapping
      })
      metric_value = this._calculate_plays_metric({
        plays: relevant_plays,
        mapping
      })
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
   * Score the selected player against the game's first touchdown
   *
   * nfl_plays names three players per row and none of them is labelled as the
   * scorer, so the scorer is inferred from the kind of play: a rushing
   * touchdown is scored by the ball carrier, a touchdown on a completed pass by
   * the target. Every other touchdown -- a kickoff, punt or fumble return, a
   * pass intercepted and returned -- is scored by a player this row does not
   * name, and ball_carrier_pid/target_pid then hold whoever was carrying or
   * being thrown to, not the scorer. Crediting them would settle the market
   * against the wrong player, so the market is failed instead.
   *
   * The play-shape inference is guarded by touchdown_nfl_team rather than
   * standing on its own, because the shape flags survive a turnover: a rush
   * fumbled and returned is still is_rushing_play. Only the scoring team tells
   * an offensive touchdown from a defensive one, so a row that does not name it
   * fails too rather than being credited blind.
   *
   * @param {object} params - Named parameters
   * @param {Array<object>} params.game_plays - All plays for the game
   * @param {object} params.market - Market object containing selection criteria
   * @param {object} params.mapping - Market mapping configuration
   * @returns {number} 1 if the selected player scored the first touchdown, else 0
   * @throws {Error} If the first touchdown's scorer cannot be identified
   */
  _calculate_first_touchdown_metric({ game_plays, market, mapping }) {
    const touchdown_column = mapping.metric_columns[0]
    const first_touchdown_play = game_plays.find(
      (play) => play[touchdown_column] === true
    )

    if (!first_touchdown_play) {
      return 0
    }

    // The play shape alone does not say WHICH SIDE scored. A rush or a
    // completed pass that is fumbled and returned is still is_rushing_play or
    // is_passing_play, and ball_carrier_pid/target_pid then hold the player who
    // lost the ball rather than the defender who scored. touchdown_nfl_team is
    // the only column that settles the question, so the inference below runs
    // only once the scoring side is known to be the offense.
    if (
      first_touchdown_play.touchdown_nfl_team === null ||
      first_touchdown_play.touchdown_nfl_team === undefined
    ) {
      throw new Error(
        `First touchdown in game ${market.esbid} does not name the scoring team, so its scorer cannot be attributed`
      )
    }

    if (
      first_touchdown_play.touchdown_nfl_team !==
      first_touchdown_play.offense_nfl_team
    ) {
      throw new Error(
        `First touchdown in game ${market.esbid} was scored by the defense and nfl_plays does not name its scorer`
      )
    }

    let scorer_pid = null
    if (first_touchdown_play.is_rushing_play === true) {
      scorer_pid = first_touchdown_play.ball_carrier_pid
    } else if (
      first_touchdown_play.is_passing_play === true &&
      first_touchdown_play.is_completion === true
    ) {
      scorer_pid = first_touchdown_play.target_pid
    }

    if (!scorer_pid) {
      throw new Error(
        `First touchdown in game ${market.esbid} was not scored on a rush or a completed pass and nfl_plays does not name its scorer`
      )
    }

    return scorer_pid === market.selection_pid ? 1 : 0
  }

  /**
   * Whether the mapping sums yardage credited to more than one player column
   * @param {object} mapping - Market mapping configuration
   * @returns {boolean} True for combined passing/rushing/receiving player markets
   */
  _is_combined_player_market(mapping) {
    return (
      mapping.special_logic === 'combined_passing_rushing' ||
      mapping.special_logic === 'combined_rushing_receiving'
    )
  }

  /**
   * Sum a combined market's metric columns, each against its own player column
   *
   * A combined market spans plays where the selected player appears in
   * different roles -- passer on his pass plays, ball carrier on his scrambles
   * -- so filtering the game to one player column would drop half the
   * production before the sum ever sees it.
   *
   * @param {object} params - Named parameters
   * @param {Array<object>} params.game_plays - All plays for the game
   * @param {object} params.market - Market object containing selection criteria
   * @param {object} params.mapping - Market mapping configuration
   * @returns {number} Summed metric value
   * @throws {Error} If a metric column has no known player attribution
   */
  _calculate_combined_player_metric({ game_plays, market, mapping }) {
    if (!market.selection_pid) {
      return 0
    }

    const plays = this._apply_period_filters({ plays: game_plays, mapping })

    let total = 0
    for (const metric_column of mapping.metric_columns) {
      const player_column = PLAY_METRIC_PLAYER_COLUMNS[metric_column]
      if (!player_column) {
        throw new Error(
          `No player attribution for metric column ${metric_column}`
        )
      }

      for (const play of plays) {
        if (play[player_column] !== market.selection_pid) {
          continue
        }
        total += Number(play[metric_column]) || 0
      }
    }

    return total
  }

  /**
   * Restrict plays to the quarter or half the mapping scopes the market to
   * @param {object} params - Named parameters
   * @param {Array<object>} params.plays - Plays to restrict
   * @param {object} params.mapping - Market mapping configuration
   * @returns {Array<object>} Plays within the mapping's period
   */
  _apply_period_filters({ plays, mapping }) {
    if (mapping.quarter_filter) {
      return plays.filter((play) => play.quarter === mapping.quarter_filter)
    }
    if (mapping.half_filter === 1) {
      return plays.filter((play) => play.quarter === 1 || play.quarter === 2)
    }
    if (mapping.half_filter === 2) {
      return plays.filter((play) => play.quarter === 3 || play.quarter === 4)
    }
    return plays
  }

  /**
   * Filter plays based on market requirements (player, team, quarter, etc.)
   * @param {object} params - Named parameters
   * @param {Array<object>} params.game_plays - All plays for a specific game
   * @param {object} params.market - Market object containing selection criteria
   * @param {object} params.mapping - Market mapping configuration
   * @returns {Array<object>} Filtered plays relevant to the market
   */
  _filter_plays_for_market({ game_plays, market, mapping }) {
    // For team aggregate markets, filter by offensive team
    if (mapping.team_aggregate) {
      if (!market.selection_pid) {
        return []
      }
      return this._apply_period_filters({
        plays: game_plays.filter(
          (play) => play.offense_nfl_team === market.selection_pid
        ),
        mapping
      })
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

    filtered_plays = this._apply_period_filters({
      plays: filtered_plays,
      mapping
    })

    // Drop plays the market's metric does not reach at all. A play carrying a
    // value in any one of the metric columns still counts toward the sum, so
    // only a play null in every one of them is irrelevant.
    if (mapping.metric_columns && mapping.metric_columns.length > 0) {
      filtered_plays = filtered_plays.filter((play) =>
        mapping.metric_columns.some(
          (column) => play[column] !== null && play[column] !== undefined
        )
      )
    }

    return filtered_plays
  }

  /**
   * Calculate metric value from filtered plays based on aggregation type
   * @param {object} params - Named parameters
   * @param {Array<object>} params.plays - Filtered plays to calculate from
   * @param {object} params.mapping - Market mapping configuration
   * @returns {number} Calculated metric value
   */
  _calculate_plays_metric({ plays, mapping }) {
    if (
      mapping.special_logic === 'count_receptions' ||
      mapping.special_logic === 'count_attempts'
    ) {
      // Both count plays whose single flag column is set: a reception is a
      // completed pass, an attempt is a rush or pass play.
      return plays.filter((play) => play[mapping.metric_columns[0]] === true)
        .length
    } else if (mapping.aggregation_type === 'MAX') {
      const values = plays.map((play) => calculate_metric_value(play, mapping))
      return values.length > 0 ? Math.max(...values) : 0
    } else {
      // Default to sum aggregation
      let total = 0
      for (const play of plays) {
        total += calculate_metric_value(play, mapping) || 0
      }
      if (mapping.net_of_sack_yards) {
        total += this._sum_sack_yards(plays)
      }
      return total
    }
  }

  /**
   * Sum the sack yardage on a set of plays
   *
   * A sack carries its loss as a negative yards_gained and nothing in
   * rush_yards, receiving_yards or pass_yards, so it reaches the metric through
   * neither. The return is negative or zero and is ADDED to the gross total,
   * which is what turns it into the NFL's net figure.
   *
   * @param {Array<object>} plays - Plays already filtered to the market's team and period
   * @returns {number} Sack yardage, negative or zero
   */
  _sum_sack_yards(plays) {
    let sack_yards = 0
    for (const play of plays) {
      if (play.is_sack !== true) {
        continue
      }
      // A sack with no yardage loaded is a hole in the metric, not a zero-yard
      // sack: settling past it understates the loss and grades the market high,
      // which is the defect this whole path exists to remove.
      if (play.yards_gained === null || play.yards_gained === undefined) {
        throw new Error(
          `Sack play in game ${play.esbid} has no yards_gained, so team net yards cannot be settled`
        )
      }
      sack_yards += Number(play.yards_gained) || 0
    }
    return sack_yards
  }
}

/**
 * NFL Games Market Handler
 * Processes game-level markets using preloaded NFL games data
 */
export class NFLGamesMarketHandler extends MarketDataHandler {
  constructor(nfl_games) {
    super(HANDLER_TYPES.NFL_GAMES)
    this.data_by_game = group_by_game(nfl_games)
  }

  /**
   * Process a single market using NFL games data
   * @param {object} market - Market object to process
   * @returns {Array<object>} Array with OPEN and CLOSE result objects
   */
  _process_single_market(market) {
    const mapping = this._get_market_mapping(market)
    const [game] = this.data_by_game[market.esbid] || []

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
   * @param {object} game - Game data with home_nfl_team and away_nfl_team team codes
   * @returns {{ is_home_team: boolean }|null} Team info or null if not found
   */
  _validate_team_selection(selection_pid, game) {
    if (selection_pid === game.home_nfl_team) {
      return { is_home_team: true }
    }
    if (selection_pid === game.away_nfl_team) {
      return { is_home_team: false }
    }
    return null
  }

  /**
   * Process game outcome markets (spread, total, moneyline)
   * @param {object} params - Named parameters
   * @param {object} params.market - Market object
   * @param {object} params.game - Game data with home_nfl_team, away_nfl_team, home_score, away_score
   * @param {object} params.mapping - Market mapping configuration
   * @returns {Array<object>} Array with OPEN and CLOSE result objects
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
            `Selection ${market.selection_pid} not found in game (home: ${game.home_nfl_team}, away: ${game.away_nfl_team})`
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
            `Selection ${market.selection_pid} not found in game (home: ${game.home_nfl_team}, away: ${game.away_nfl_team})`
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
}
