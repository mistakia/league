import debug from 'debug'

import { HANDLER_TYPES } from './market-type-mappings.mjs'
import { get_market_mapping_with_fallback } from './mapping-utils.mjs'

const log = debug('nfl-games-handler')

export class NFLGamesHandler {
  constructor(db) {
    this.db = db
    this.type = HANDLER_TYPES.NFL_GAMES
    this.cache = new Map() // Cache for prefetched data
  }

  async calculate({
    esbid,
    market_type,
    mapping,
    selection_pid = null,
    selection_metric_line = null,
    selection_type = null
  }) {
    log(`Calculating ${market_type} for game ${esbid}`)

    // Get the game data
    const game = await this._get_game_data(esbid)

    if (!game) {
      throw new Error(`No game data found for esbid ${esbid}`)
    }

    // Calculate based on the calculation type
    const result_data = this._calculate_game_result({
      game,
      mapping,
      selection_type,
      selection_metric_line
    })

    return {
      esbid,
      market_type,
      selection_type,
      selection_metric_line,
      metric_value: result_data.metric_value,
      selection_result: result_data.result,
      handler_type: this.type
    }
  }

  async batch_calculate(markets) {
    log(`Batch calculating ${markets.length} NFL games markets`)

    // Group markets by game to minimize queries
    const markets_by_game = this._group_markets_by_game(markets)
    const results = []

    for (const [esbid, game_markets] of Object.entries(markets_by_game)) {
      // Get game data once per game
      const game = await this._get_game_data(esbid)

      if (!game) {
        // Add error results for all markets in this game
        for (const failed_market of game_markets) {
          results.push({
            esbid: failed_market.esbid,
            market_type: failed_market.market_type,
            selection_type: failed_market.selection_type,
            selection_metric_line: failed_market.selection_metric_line,
            error: `No game data found for esbid ${esbid}`,
            selection_result: null,
            metric_value: null,
            handler_type: this.type
          })
        }
        continue
      }

      // Calculate results for all markets in this game
      for (const market of game_markets) {
        try {
          const mapping = get_market_mapping_with_fallback(market)

          const result_data = this._calculate_game_result({
            game,
            mapping,
            selection_type: market.selection_type,
            selection_metric_line: market.selection_metric_line
          })

          results.push({
            esbid: market.esbid,
            market_type: market.market_type,
            selection_type: market.selection_type,
            selection_metric_line: market.selection_metric_line,
            source_id: market.source_id,
            source_market_id: market.source_market_id,
            source_selection_id: market.source_selection_id,
            metric_value: result_data.metric_value,
            selection_result: result_data.result,
            handler_type: this.type
          })
        } catch (error) {
          log(`Error calculating market: ${error.message}`)
          results.push({
            esbid: market.esbid,
            market_type: market.market_type,
            selection_type: market.selection_type,
            selection_metric_line: market.selection_metric_line,
            error: error.message,
            selection_result: null,
            metric_value: null,
            handler_type: this.type
          })
        }
      }
    }

    return results
  }

  async prefetch(esbids) {
    log(`Prefetching NFL games for ${esbids.length} games`)

    const games = await this.db('nfl_games')
      .select(
        'esbid',
        'home_score',
        'away_score',
        'h', // home team
        'v', // away/visiting team
        'status'
      )
      .whereIn('esbid', esbids)
      .where('status', 'final') // Only final games

    // Cache by esbid for quick lookup
    for (const nfl_game of games) {
      this.cache.set(nfl_game.esbid, nfl_game)
    }

    log(`Cached ${games.length} NFL games`)
  }

  async health_check() {
    try {
      // Simple query to verify database connection and table access
      const result = await this.db('nfl_games').select('esbid').limit(1).first()

      return !!result
    } catch (error) {
      log(`Health check failed: ${error.message}`)
      return false
    }
  }

  _calculate_game_result({
    game,
    mapping,
    selection_type,
    selection_metric_line
  }) {
    const { calculation_type } = mapping

    switch (calculation_type) {
      case 'winner_determination':
        return this._calculate_moneyline_result(game, selection_type)

      case 'point_differential_vs_spread':
        return this._calculate_spread_result(
          game,
          selection_type,
          selection_metric_line
        )

      case 'total_points':
        return this._calculate_total_result(
          game,
          selection_type,
          selection_metric_line
        )

      default:
        throw new Error(`Unknown calculation type: ${calculation_type}`)
    }
  }

  _calculate_moneyline_result(game, selection_type) {
    const home_score = game.home_score || 0
    const away_score = game.away_score || 0

    let winner_team
    if (home_score > away_score) {
      winner_team = game.h // home team wins
    } else if (away_score > home_score) {
      winner_team = game.v // away team wins
    } else {
      // Tie - both lose in moneyline
      return {
        metric_value: null,
        result: 'LOST'
      }
    }

    // selection_type should be the team ID for moneyline bets
    const result = selection_type === winner_team ? 'WON' : 'LOST'

    return {
      metric_value: winner_team,
      result
    }
  }

  _calculate_spread_result(game, selection_type, selection_metric_line) {
    const home_score = game.home_score || 0
    const away_score = game.away_score || 0
    const spread = selection_metric_line || 0

    // Point differential from home team perspective
    const point_differential = home_score - away_score

    let result
    if (selection_type === game.h) {
      // Betting on home team
      // Home team covers if point_differential > spread (accounting for spread direction)
      if (point_differential === spread) {
        result = 'PUSH'
      } else {
        result = point_differential > spread ? 'WON' : 'LOST'
      }
    } else if (selection_type === game.v) {
      // Betting on away team
      // Away team covers if point_differential < spread (accounting for spread direction)
      if (point_differential === spread) {
        result = 'PUSH'
      } else {
        result = point_differential < spread ? 'WON' : 'LOST'
      }
    } else {
      throw new Error(`Invalid team selection for spread: ${selection_type}`)
    }

    return {
      metric_value: point_differential,
      result
    }
  }

  _calculate_total_result(game, selection_type, selection_metric_line) {
    const home_score = game.home_score || 0
    const away_score = game.away_score || 0
    const total_points = home_score + away_score
    const line = selection_metric_line || 0

    let result
    if (total_points === line) {
      result = 'PUSH'
    } else if (selection_type === 'OVER') {
      result = total_points > line ? 'WON' : 'LOST'
    } else if (selection_type === 'UNDER') {
      result = total_points < line ? 'WON' : 'LOST'
    } else {
      throw new Error(`Invalid selection type for total: ${selection_type}`)
    }

    return {
      metric_value: total_points,
      result
    }
  }

  async _get_game_data(esbid) {
    // Check cache first
    const cached_nfl_game = this.cache.get(esbid)

    if (cached_nfl_game) {
      return cached_nfl_game
    }

    // Query database
    const nfl_game = await this.db('nfl_games')
      .select('esbid', 'home_score', 'away_score', 'h', 'v', 'status')
      .where('esbid', esbid)
      .where('status', 'final')
      .first()

    return nfl_game
  }

  _group_markets_by_game(markets) {
    const groups = {}

    for (const market of markets) {
      const esbid = market.esbid
      if (!groups[esbid]) {
        groups[esbid] = []
      }
      groups[esbid].push(market)
    }

    return groups
  }

  clear_cache() {
    this.cache.clear()
    log('NFL games cache cleared')
  }

  get_cache_stats() {
    return {
      games_cached: this.cache.size,
      cache_size_mb: this._estimate_cache_size()
    }
  }

  _estimate_cache_size() {
    // Rough estimation of cache memory usage
    const estimated_size_per_game = 1024 // bytes
    return (
      Math.round(
        ((this.cache.size * estimated_size_per_game) / (1024 * 1024)) * 100
      ) / 100
    )
  }
}

export default NFLGamesHandler
