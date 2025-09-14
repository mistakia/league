import debug from 'debug'

import { HANDLER_TYPES } from './market-type-mappings.mjs'
import { get_market_mapping_with_fallback } from './mapping-utils.mjs'

const log = debug('team-stats-handler')

// Map gamelog columns to aggregated team stat columns
const TEAM_STATS_COLUMN_MAPPING = {
  py: 'team_passing_yards',
  ry: 'team_rushing_yards',
  recy: 'team_receiving_yards',
  tdp: 'team_passing_touchdowns',
  tdr: 'team_rushing_touchdowns',
  tdrec: 'team_receiving_touchdowns',
  dsk: 'team_sacks',
  dint: 'team_interceptions'
}

export class TeamStatsHandler {
  constructor(db) {
    this.db = db
    this.type = HANDLER_TYPES.TEAM_STATS
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

    // Get aggregated team stats for this game
    const team_stats = await this._get_team_stats_for_game(esbid)

    if (!team_stats || team_stats.length === 0) {
      throw new Error(`No team stats found for game ${esbid}`)
    }

    // Validate inputs
    this._validate_calculate_inputs(esbid, market_type, mapping, selection_type)

    // Calculate the metric value based on mapping
    const calculated_metric_value = this._calculate_team_metric_value(
      team_stats,
      mapping,
      selection_type
    )

    // Determine the result
    const selection_result = this._determine_selection_result({
      metric_value: calculated_metric_value,
      selection_type,
      selection_metric_line,
      mapping
    })

    return {
      esbid,
      market_type,
      selection_type,
      selection_metric_line,
      metric_value: calculated_metric_value,
      selection_result,
      handler_type: this.type
    }
  }

  async batch_calculate(markets) {
    log(`Batch calculating ${markets.length} team stats markets`)

    // Group markets by game to minimize queries
    const markets_by_game = this._group_markets_by_game(markets)
    const results = []

    for (const [esbid, game_markets] of Object.entries(markets_by_game)) {
      // Get team stats for this game
      const team_stats = await this._get_team_stats_for_game(esbid)

      if (!team_stats || team_stats.length === 0) {
        // Add error results for all markets in this game
        for (const failed_market of game_markets) {
          results.push({
            esbid: failed_market.esbid,
            market_type: failed_market.market_type,
            selection_type: failed_market.selection_type,
            selection_metric_line: failed_market.selection_metric_line,
            error: `No team stats found for game ${esbid}`,
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
          const prop_market_mapping = get_market_mapping_with_fallback(market)

          const calculated_metric_value = this._calculate_team_metric_value(
            team_stats,
            prop_market_mapping,
            market.selection_type
          )

          const selection_result = this._determine_selection_result({
            metric_value: calculated_metric_value,
            selection_type: market.selection_type,
            selection_metric_line: market.selection_metric_line,
            mapping: prop_market_mapping
          })

          results.push({
            esbid: market.esbid,
            market_type: market.market_type,
            selection_type: market.selection_type,
            selection_metric_line: market.selection_metric_line,
            metric_value: calculated_metric_value,
            selection_result,
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
    log(`Prefetching team stats for ${esbids.length} games`)

    const aggregated_team_stats = await this._build_team_stats_query()
      .whereIn('esbid', esbids)

    // Cache by esbid for quick lookup
    for (const team_stat of aggregated_team_stats) {
      const cache_key = team_stat.esbid
      if (!this.cache.has(cache_key)) {
        this.cache.set(cache_key, [])
      }
      this.cache.get(cache_key).push(team_stat)
    }

    log(`Cached team stats for ${aggregated_team_stats.length} team-games`)
  }

  async health_check() {
    try {
      // Simple query to verify database connection and table access
      const result = await this.db('player_gamelogs')
        .select('esbid', 'tm')
        .where('active', true)
        .limit(1)
        .first()

      return !!result
    } catch (error) {
      log(`Health check failed: ${error.message}`)
      return false
    }
  }

  _build_team_stats_query() {
    return this.db('player_gamelogs')
      .select(
        'esbid',
        'tm',
        this.db.raw('SUM(py) as team_passing_yards'),
        this.db.raw('SUM(ry) as team_rushing_yards'),
        this.db.raw('SUM(recy) as team_receiving_yards'),
        this.db.raw('SUM(tdp) as team_passing_touchdowns'),
        this.db.raw('SUM(tdr) as team_rushing_touchdowns'),
        this.db.raw('SUM(tdrec) as team_receiving_touchdowns'),
        this.db.raw('SUM(dsk) as team_sacks'),
        this.db.raw('SUM(dint) as team_interceptions'),
        this.db.raw('COUNT(*) as active_players')
      )
      .where('active', true)
      .groupBy('esbid', 'tm')
  }

  _calculate_team_metric_value(aggregated_team_stats, mapping, selection_type) {
    // Find the team stats for the selection
    let selected_team_stats

    if (mapping.team_filter) {
      // Filter by specific team
      selected_team_stats = aggregated_team_stats.find(
        (team_stat) => team_stat.tm === selection_type
      )
      
      if (!selected_team_stats) {
        throw new Error(`No team stats found for team: ${selection_type}`)
      }
    } else {
      // For comparative metrics, use all team stats
      selected_team_stats = aggregated_team_stats
    }

    // Calculate based on the metric column(s)
    if (!mapping.metric_columns || mapping.metric_columns.length === 0) {
      throw new Error(
        `No metric calculation defined for mapping: ${JSON.stringify(mapping)}`
      )
    }

    // Sum all specified columns (handles both single and multiple columns)
    return mapping.metric_columns.reduce((total_metric_value, gamelog_column) => {
      const aggregated_column = TEAM_STATS_COLUMN_MAPPING[gamelog_column] || gamelog_column
      return total_metric_value + (selected_team_stats[aggregated_column] || 0)
    }, 0)
  }


  _determine_selection_result({
    metric_value,
    selection_type,
    selection_metric_line,
    mapping
  }) {
    // Validate selection type
    this._validate_selection_type(selection_type, mapping)

    if (metric_value === selection_metric_line) {
      return 'PUSH'
    } else if (selection_type === 'OVER') {
      return metric_value > selection_metric_line ? 'WON' : 'LOST'
    } else if (selection_type === 'UNDER') {
      return metric_value < selection_metric_line ? 'WON' : 'LOST'
    }

    // For team-specific selections, the result depends on the specific market type
    // This would need to be expanded based on actual team markets
    throw new Error(`Unknown selection type for team stats: ${selection_type}`)
  }

  _validate_selection_type(selection_type, mapping) {
    const valid_selection_types = ['OVER', 'UNDER']
    
    if (mapping.team_filter) {
      // For team-filtered markets, validate that selection_type is a valid team code
      const valid_team_codes = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 
                               'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 
                               'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 
                               'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS']
      
      if (!valid_team_codes.includes(selection_type)) {
        throw new Error(`Invalid team code: ${selection_type}. Expected one of: ${valid_team_codes.join(', ')}`)
      }
    } else {
      if (!valid_selection_types.includes(selection_type)) {
        throw new Error(`Invalid selection type: ${selection_type}. Expected one of: ${valid_selection_types.join(', ')}`)
      }
    }
  }

  async _get_team_stats_for_game(esbid) {
    // Check cache first
    const cache_key = esbid
    const cached_team_stats = this.cache.get(cache_key)

    if (cached_team_stats) {
      return cached_team_stats
    }

    // Query database
    const aggregated_team_stats = await this._build_team_stats_query()
      .where('esbid', esbid)

    return aggregated_team_stats
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
    log('Team stats cache cleared')
  }

  get_cache_stats() {
    const cached_games_count = this.cache.size
    const total_cached_team_stats = Array.from(this.cache.values()).reduce(
      (total_count, team_stats_array) => total_count + team_stats_array.length,
      0
    )

    return {
      games_cached: cached_games_count,
      total_team_stats: total_cached_team_stats,
      cache_size_mb: this._estimate_cache_size()
    }
  }

  _estimate_cache_size() {
    // Rough estimation of cache memory usage
    const estimated_bytes_per_team_stat = 1024 // bytes
    const total_cached_team_stats = Array.from(this.cache.values()).reduce(
      (total_count, team_stats_array) => total_count + team_stats_array.length,
      0
    )
    return (
      Math.round(
        ((total_cached_team_stats * estimated_bytes_per_team_stat) / (1024 * 1024)) * 100
      ) / 100
    )
  }

  _validate_calculate_inputs(esbid, market_type, mapping, selection_type) {
    if (!esbid) {
      throw new Error('esbid is required for team stats calculation')
    }
    
    if (!market_type) {
      throw new Error('market_type is required for team stats calculation')
    }
    
    if (!mapping) {
      throw new Error('mapping is required for team stats calculation')
    }
    
    if (!selection_type) {
      throw new Error('selection_type is required for team stats calculation')
    }
  }
}

export default TeamStatsHandler
