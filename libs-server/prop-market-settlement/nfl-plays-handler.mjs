import debug from 'debug'

import { HANDLER_TYPES } from './market-type-mappings.mjs'
import { get_market_mapping_with_fallback } from './mapping-utils.mjs'

const log = debug('nfl-plays-handler')

// Common columns selected for NFL plays queries
const PLAY_COLUMNS = [
  'esbid',
  'qtr',
  'pass_yds',
  'recv_yds',
  'rush_yds',
  'psr_pid',
  'trg_pid',
  'bc_pid',
  'play_type'
]

export class NFLPlaysHandler {
  constructor(db) {
    this.db = db
    this.type = HANDLER_TYPES.NFL_PLAYS
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

    // Get plays for this game and player
    const plays = await this._get_player_plays(esbid, selection_pid, mapping)

    // Calculate the metric value
    const metric_value = this._calculate_metric_value(plays, mapping)

    // Determine the result
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
    log(`Batch calculating ${markets.length} NFL plays markets`)

    // Group markets by game to minimize queries
    const markets_by_game = this._group_markets_by_game(markets)
    const results = []

    for (const [esbid, game_markets] of Object.entries(markets_by_game)) {
      // Get all plays for this game
      const plays = await this._get_game_plays(esbid)

      // Calculate results for all markets in this game
      for (const market of game_markets) {
        try {
          const mapping = get_market_mapping_with_fallback(market)

          // Filter plays for this specific player and mapping
          const player_plays = this._filter_plays_for_player(
            plays,
            market.selection_pid,
            mapping
          )

          const metric_value = this._calculate_metric_value(
            player_plays,
            mapping
          )

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
            esbid: market.esbid,
            market_type: market.market_type,
            selection_pid: market.selection_pid,
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
    log(`Prefetching NFL plays for ${esbids.length} games`)

    const plays = await this.db('nfl_plays')
      .select(PLAY_COLUMNS)
      .whereIn('esbid', esbids)
      .whereNot('play_type', 'NOPL') // Exclude no-play entries

    // Cache by esbid for quick lookup
    for (const play of plays) {
      const cache_key = `${play.esbid}`
      if (!this.cache.has(cache_key)) {
        this.cache.set(cache_key, [])
      }
      this.cache.get(cache_key).push(play)
    }

    log(`Cached ${plays.length} NFL plays`)
  }

  async health_check() {
    try {
      // Simple query to verify database connection and table access
      const result = await this.db('nfl_plays').select('esbid').limit(1).first()

      return !!result
    } catch (error) {
      log(`Health check failed: ${error.message}`)
      return false
    }
  }

  _calculate_metric_value(plays, mapping) {
    if (!plays || plays.length === 0) {
      return 0
    }

    if (!mapping.metric_columns || mapping.metric_columns.length === 0) {
      throw new Error(
        `No metric columns defined for mapping: ${JSON.stringify(mapping)}`
      )
    }

    // For NFL plays, we typically only have one metric column
    const metric_column = mapping.metric_columns[0]

    // Validate that the metric column exists in the play data
    if (plays.length > 0 && !(metric_column in plays[0])) {
      throw new Error(
        `Metric column '${metric_column}' not found in play data. Available columns: ${Object.keys(plays[0]).join(', ')}`
      )
    }

    const values = plays.map((play) => play[metric_column] || 0)

    if (mapping.aggregation_type === 'MAX') {
      return Math.max(...values, 0)
    } else {
      // Default to SUM for yards
      return values.reduce((sum, val) => sum + val, 0)
    }
  }

  _determine_selection_result({
    metric_value,
    selection_type,
    selection_metric_line,
    mapping
  }) {
    if (metric_value === selection_metric_line) {
      return 'PUSH'
    } else if (selection_type === 'OVER') {
      return metric_value > selection_metric_line ? 'WON' : 'LOST'
    } else if (selection_type === 'UNDER') {
      return metric_value < selection_metric_line ? 'WON' : 'LOST'
    }

    throw new Error(`Unknown selection type: ${selection_type}`)
  }

  async _get_player_plays(esbid, pid, mapping) {
    // Check cache first
    const cache_key = `${esbid}`
    const cached_plays = this.cache.get(cache_key)

    if (cached_plays) {
      return this._filter_plays_for_player(cached_plays, pid, mapping)
    }

    // Query database
    const plays = await this.db('nfl_plays')
      .select(PLAY_COLUMNS)
      .where('esbid', esbid)
      .whereNot('play_type', 'NOPL')

    return this._filter_plays_for_player(plays, pid, mapping)
  }

  async _get_game_plays(esbid) {
    // Check cache first
    const cache_key = `${esbid}`
    const cached_plays = this.cache.get(cache_key)

    if (cached_plays) {
      return cached_plays
    }

    // Query database
    const plays = await this.db('nfl_plays')
      .select(PLAY_COLUMNS)
      .where('esbid', esbid)
      .whereNot('play_type', 'NOPL')

    return plays
  }

  _filter_plays_for_player(plays, pid, mapping) {
    if (!plays || !pid || !mapping.player_column) {
      return []
    }

    // Validate that the player column exists in the play data
    if (plays.length > 0 && !(mapping.player_column in plays[0])) {
      throw new Error(
        `Player column '${mapping.player_column}' not found in play data. Available columns: ${Object.keys(plays[0]).join(', ')}`
      )
    }

    let filtered_plays = plays.filter(
      (play) => play[mapping.player_column] === pid
    )

    // Apply quarter filter if specified
    if (mapping.quarter_filter) {
      filtered_plays = filtered_plays.filter(
        (play) => play.qtr === mapping.quarter_filter
      )
    }

    // Filter out plays with null/undefined metric values
    if (mapping.metric_columns && mapping.metric_columns.length > 0) {
      const metric_column = mapping.metric_columns[0]
      filtered_plays = filtered_plays.filter((play) => {
        const value = play[metric_column]
        return value !== null && value !== undefined
      })
    }

    return filtered_plays
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
    log('NFL plays cache cleared')
  }

  get_cache_stats() {
    const total_entries = this.cache.size
    const total_plays = Array.from(this.cache.values()).reduce(
      (sum, plays) => sum + plays.length,
      0
    )

    return {
      games_cached: total_entries,
      total_plays,
      cache_size_mb: this._estimate_cache_size()
    }
  }

  _estimate_cache_size() {
    // Rough estimation of cache memory usage
    const estimated_size_per_play = 512 // bytes
    const total_cached_plays = Array.from(this.cache.values()).reduce(
      (total_count, nfl_plays_array) => total_count + nfl_plays_array.length,
      0
    )
    return (
      Math.round(
        ((total_cached_plays * estimated_size_per_play) / (1024 * 1024)) * 100
      ) / 100
    )
  }
}

export default NFLPlaysHandler
