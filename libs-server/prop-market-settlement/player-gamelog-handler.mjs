import debug from 'debug'

import { HANDLER_TYPES } from './market-type-mappings.mjs'
import { get_market_mapping_with_fallback } from './mapping-utils.mjs'

const log = debug('player-gamelog-handler')

export class PlayerGamelogHandler {
  constructor(db) {
    this.db = db
    this.type = HANDLER_TYPES.PLAYER_GAMELOG
    this.cache = new Map() // Cache for prefetched data
  }

  async calculate({
    esbid,
    market_type,
    mapping,
    selection_pid,
    selection_metric_line,
    selection_type
  }) {
    log(
      `Calculating ${market_type} for player ${selection_pid} in game ${esbid}`
    )

    // Get the player's gamelog for this specific game
    const gamelog = await this._get_player_gamelog(esbid, selection_pid)

    if (!gamelog) {
      throw new Error(
        `No gamelog found for player ${selection_pid} in game ${esbid}`
      )
    }

    // Calculate the metric value based on mapping
    const metric_value = this._calculate_metric_value(gamelog, mapping)

    // Determine the result based on selection type and line
    const result = this._determine_selection_result({
      metric_value,
      selection_type,
      selection_metric_line,
      mapping
    })

    return {
      esbid,
      market_type,
      selection_pid,
      selection_type,
      selection_metric_line,
      metric_value,
      selection_result: result,
      handler_type: this.type
    }
  }

  async batch_calculate(markets) {
    log(`Batch calculating ${markets.length} player gamelog markets`)

    // Group markets by game to minimize queries
    const markets_by_game = this._group_markets_by_game(markets)
    const results = []

    for (const [esbid, game_markets] of Object.entries(markets_by_game)) {
      // Get all unique player IDs for this game
      const player_ids = [
        ...new Set(game_markets.map((m) => m.selection_pid).filter(Boolean))
      ]

      // Batch fetch gamelogs for all players in this game
      const gamelogs = await this._get_player_gamelogs_batch(esbid, player_ids)
      const gamelog_map = new Map(gamelogs.map((g) => [g.pid, g]))

      // Calculate results for all markets in this game
      for (const market of game_markets) {
        try {
          const gamelog = gamelog_map.get(market.selection_pid)

          if (!gamelog) {
            results.push({
              ...market,
              error: `No gamelog found for player ${market.selection_pid} in game ${esbid}`,
              result: null,
              metric_value: null
            })
            continue
          }

          const mapping = get_market_mapping_with_fallback(market)
          const metric_value = this._calculate_metric_value(gamelog, mapping)

          const result = this._determine_selection_result({
            metric_value,
            selection_type: market.selection_type,
            selection_metric_line: market.selection_metric_line,
            mapping
          })

          results.push({
            esbid: market.esbid,
            market_type: market.market_type,
            selection_pid: market.selection_pid,
            selection_type: market.selection_type,
            selection_metric_line: market.selection_metric_line,
            source_id: market.source_id,
            source_market_id: market.source_market_id,
            source_selection_id: market.source_selection_id,
            metric_value,
            selection_result: result,
            handler_type: this.type
          })
        } catch (error) {
          log(`Error calculating market: ${error.message}`)
          results.push({
            ...market,
            error: error.message,
            selection_result: null,
            metric_value: null
          })
        }
      }
    }

    return results
  }

  async prefetch(esbids) {
    log(`Prefetching player gamelogs for ${esbids.length} games`)

    const gamelogs = await this._buildGamelogQuery(this.db('player_gamelogs'))
      .whereIn('player_gamelogs.esbid', esbids)
      .where('player_gamelogs.active', true)

    // Cache by esbid for quick lookup
    for (const gamelog of gamelogs) {
      const cache_key = `${gamelog.esbid}`
      if (!this.cache.has(cache_key)) {
        this.cache.set(cache_key, [])
      }
      this.cache.get(cache_key).push(gamelog)
    }

    log(`Cached ${gamelogs.length} player gamelogs`)
  }

  async health_check() {
    try {
      // Simple query to verify database connection and table access
      const result = await this.db('player_gamelogs')
        .select('esbid')
        .limit(1)
        .first()

      return !!result
    } catch (error) {
      log(`Health check failed: ${error.message}`)
      return false
    }
  }

  _buildGamelogQuery(baseQuery) {
    return baseQuery
      .leftJoin('player_receiving_gamelogs', function () {
        this.on('player_gamelogs.esbid', '=', 'player_receiving_gamelogs.esbid')
            .andOn('player_gamelogs.pid', '=', 'player_receiving_gamelogs.pid')
      })
      .leftJoin('player_rushing_gamelogs', function () {
        this.on('player_gamelogs.esbid', '=', 'player_rushing_gamelogs.esbid')
            .andOn('player_gamelogs.pid', '=', 'player_rushing_gamelogs.pid')
      })
      .select(
        'player_gamelogs.*',
        'player_receiving_gamelogs.longest_reception',
        'player_rushing_gamelogs.longest_rush'
      )
  }

  _validate_metric_columns(gamelog, mapping) {
    if (!mapping.metric_columns || mapping.metric_columns.length === 0) {
      throw new Error(`No metric columns defined for mapping: ${JSON.stringify(mapping)}`)
    }

    for (const col of mapping.metric_columns) {
      if (!(col in gamelog)) {
        throw new Error(`Metric column '${col}' not found in gamelog data. Available columns: ${Object.keys(gamelog).join(', ')}`)
      }
    }
  }

  _calculate_metric_value(gamelog, mapping) {
    // Validate columns exist before calculation
    this._validate_metric_columns(gamelog, mapping)

    if (mapping.special_logic === 'anytime_touchdown') {
      // Special case for anytime touchdown - any non-zero touchdown count
      const total_tds = mapping.metric_columns.reduce((sum, col) => {
        return sum + (gamelog[col] || 0)
      }, 0)
      return total_tds > 0 ? 1 : 0
    }

    // Sum all specified columns (handles both single and multiple columns)
    return mapping.metric_columns.reduce((sum, col) => {
      return sum + (gamelog[col] || 0)
    }, 0)
  }

  _determine_selection_result({
    metric_value,
    selection_type,
    selection_metric_line,
    mapping
  }) {
    if (mapping.special_logic === 'anytime_touchdown') {
      // Validate that special logic has required selection types
      if (selection_type !== 'YES' && selection_type !== 'NO') {
        throw new Error(`Invalid selection type '${selection_type}' for anytime touchdown. Expected 'YES' or 'NO'`)
      }
      
      // For anytime touchdown, metric_value is already 1 or 0
      if (selection_type === 'YES') {
        return metric_value === 1 ? 'WON' : 'LOST'
      } else if (selection_type === 'NO') {
        return metric_value === 0 ? 'WON' : 'LOST'
      }
    }

    if (metric_value === selection_metric_line) {
      return 'PUSH'
    } else if (selection_type === 'OVER') {
      return metric_value > selection_metric_line ? 'WON' : 'LOST'
    } else if (selection_type === 'UNDER') {
      return metric_value < selection_metric_line ? 'WON' : 'LOST'
    }

    throw new Error(`Unknown selection type: ${selection_type}`)
  }

  async _get_player_gamelog(esbid, pid) {
    // Check cache first
    const cache_key = `${esbid}`
    const cached_gamelogs = this.cache.get(cache_key)

    if (cached_gamelogs) {
      return cached_gamelogs.find((g) => g.pid === pid)
    }

    // Query database with additional gamelog data for longest play markets
    const gamelog = await this._buildGamelogQuery(this.db('player_gamelogs'))
      .where({
        'player_gamelogs.esbid': esbid,
        'player_gamelogs.pid': pid,
        'player_gamelogs.active': true
      })
      .first()

    return gamelog
  }

  async _get_player_gamelogs_batch(esbid, player_ids) {
    // Check cache first
    const cache_key = `${esbid}`
    const cached_gamelogs = this.cache.get(cache_key)

    if (cached_gamelogs) {
      return cached_gamelogs.filter((g) => player_ids.includes(g.pid))
    }

    // Query database with additional gamelog data for longest play markets
    const gamelogs = await this._buildGamelogQuery(this.db('player_gamelogs'))
      .where({ 'player_gamelogs.esbid': esbid, 'player_gamelogs.active': true })
      .whereIn('player_gamelogs.pid', player_ids)

    return gamelogs
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
    log('Player gamelog cache cleared')
  }

  get_cache_stats() {
    const total_entries = this.cache.size
    const total_gamelogs = Array.from(this.cache.values()).reduce(
      (sum, gamelogs) => sum + gamelogs.length,
      0
    )

    return {
      games_cached: total_entries,
      total_gamelogs,
      cache_size_mb: this._estimate_cache_size()
    }
  }

  _estimate_cache_size() {
    // Rough estimation of cache memory usage
    const estimated_size_per_gamelog = 2048 // bytes
    const total_gamelogs = Array.from(this.cache.values()).reduce(
      (sum, gamelogs) => sum + gamelogs.length,
      0
    )
    return (
      Math.round(
        ((total_gamelogs * estimated_size_per_gamelog) / (1024 * 1024)) * 100
      ) / 100
    )
  }
}

export default PlayerGamelogHandler
