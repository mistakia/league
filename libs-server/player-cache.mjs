import debug from 'debug'

import db from '#db'
import { fixTeam, format_player_name, constants } from '#libs-shared'
import clean_string from './clean-string.mjs'

const log = debug('player-cache')

/**
 * PlayerCache - A singleton class for caching and searching NFL players
 *
 * Provides fast lookup of players by name, team, and other criteria.
 * Caches active players (non-retired, non-free agents) and their aliases.
 */
class PlayerCache {
  constructor() {
    this.players_by_formatted_name = new Map()
    this.players_by_pid = new Map()
    this.players_by_gsisid = new Map()
    this.players_by_otc_id = new Map()
    this.players_by_sportradar_id = new Map()
    this.players_by_name_draft_year = new Map()
    this.is_initialized = false
  }

  /**
   * Preloads players and their aliases into memory cache
   * @param {Object} options - Configuration options
   * @param {boolean} options.all_players - Load all players including retired/inactive (default: false)
   * @param {boolean} options.include_otc_id_index - Build otc_id index (default: false)
   * @param {boolean} options.include_name_draft_index - Build name+draft year index (default: false)
   * @throws {Error} If database query fails
   */
  async preload_active_players({
    all_players = false,
    include_otc_id_index = false,
    include_name_draft_index = false
  } = {}) {
    if (this.is_initialized) {
      log('Player cache already initialized')
      return
    }

    log(`Initializing player cache (all_players: ${all_players})...`)
    console.time('player-cache-preload')

    try {
      const players = all_players
        ? await this._fetch_all_players()
        : await this._fetch_active_players()
      const player_aliases = await this._fetch_player_aliases(players)

      this._clear_cache()
      this._build_player_indexes(players)
      this._build_alias_indexes(player_aliases)
      this._build_gsisid_index(players)
      this._build_sportradar_id_index(players)

      if (include_otc_id_index) {
        this._build_otc_id_index(players)
      }

      if (include_name_draft_index) {
        this._build_name_draft_index(players)
      }

      this.is_initialized = true
      console.timeEnd('player-cache-preload')
      log(`Player cache initialized with ${players.length} players`)
    } catch (error) {
      log(`Error initializing player cache: ${error.message}`)
      throw error
    }
  }

  /**
   * Finds a player by various identifiers
   * @param {Object} params - Search parameters
   * @param {string} params.name - Player name to search for
   * @param {string} params.gsisid - GSIS ID to search for
   * @param {string} params.sportradar_id - Sportradar ID to search for
   * @param {number} params.otc_id - Over The Cap ID to search for
   * @param {number} params.nfl_draft_year - NFL draft year (used with name for composite lookup)
   * @param {string[]} params.teams - Optional team abbreviations to filter by
   * @param {boolean} params.ignore_free_agent - Whether to exclude free agents (default: true)
   * @param {boolean} params.ignore_retired - Whether to exclude retired players (default: true)
   * @returns {Object|null} Player object if found, null otherwise
   * @throws {Error} If cache not initialized
   */
  find_player({
    name,
    gsisid,
    sportradar_id,
    otc_id,
    nfl_draft_year,
    teams = [],
    ignore_free_agent = true,
    ignore_retired = true
  }) {
    this._ensure_initialized()

    // Fast lookup by Sportradar ID if provided
    if (sportradar_id) {
      const player = this.players_by_sportradar_id.get(sportradar_id)
      if (player) {
        const filtered_players = this._apply_filters([player], {
          teams,
          ignore_free_agent,
          ignore_retired
        })
        return filtered_players.length > 0 ? filtered_players[0] : null
      }
      return null
    }

    // Fast lookup by OTC ID if provided
    if (otc_id) {
      const player = this.players_by_otc_id.get(otc_id)
      if (player) {
        const filtered_players = this._apply_filters([player], {
          teams,
          ignore_free_agent,
          ignore_retired
        })
        return filtered_players.length > 0 ? filtered_players[0] : null
      }
      return null
    }

    // Fast lookup by GSISID if provided
    if (gsisid) {
      const player = this.players_by_gsisid.get(gsisid)
      if (player) {
        const filtered_players = this._apply_filters([player], {
          teams,
          ignore_free_agent,
          ignore_retired
        })
        return filtered_players.length > 0 ? filtered_players[0] : null
      }
      return null
    }

    // Fast lookup by name + draft year composite if both provided
    if (name && nfl_draft_year) {
      const formatted_name = format_player_name(name)
      const key = `${formatted_name}_${nfl_draft_year}`
      const player = this.players_by_name_draft_year.get(key)
      if (player) {
        const filtered_players = this._apply_filters([player], {
          teams,
          ignore_free_agent,
          ignore_retired
        })
        return filtered_players.length > 0 ? filtered_players[0] : null
      }
      // Fall through to name-only lookup if composite key not found
    }

    if (!name) {
      return null
    }

    const formatted_name = format_player_name(name)
    const potential_players =
      this.players_by_formatted_name.get(formatted_name) || []

    if (potential_players.length === 0) {
      return null
    }

    const filtered_players = this._apply_filters(potential_players, {
      teams,
      ignore_free_agent,
      ignore_retired
    })

    return this._select_best_match(filtered_players, formatted_name, teams)
  }

  /**
   * Returns cache statistics for monitoring
   * @returns {Object} Cache statistics
   */
  get_cache_stats() {
    return {
      is_initialized: this.is_initialized,
      total_players: this.players_by_pid.size,
      formatted_name_entries: this.players_by_formatted_name.size,
      gsisid_entries: this.players_by_gsisid.size,
      sportradar_id_entries: this.players_by_sportradar_id.size,
      otc_id_entries: this.players_by_otc_id.size,
      name_draft_year_entries: this.players_by_name_draft_year.size
    }
  }

  // Private methods

  /**
   * Fetches all players from database
   * @returns {Promise<Array>} Array of all player objects with cleaned formatted names
   * @private
   */
  async _fetch_all_players() {
    const players = await db('player').select('*')
    // Clean formatted names to remove null bytes
    return players.map((player) => ({
      ...player,
      formatted: clean_string(player.formatted)
    }))
  }

  /**
   * Fetches all active players from database
   * @returns {Promise<Array>} Array of active player objects with cleaned formatted names
   * @private
   */
  async _fetch_active_players() {
    const all_players = await db('player').select('*')

    // Clean formatted names and filter for active players
    return all_players
      .map((player) => ({
        ...player,
        formatted: clean_string(player.formatted)
      }))
      .filter((player) => this._is_active_player(player))
  }

  /**
   * Fetches aliases for given players
   * @param {Array} players - Array of player objects
   * @returns {Promise<Array>} Array of alias objects with cleaned formatted_alias
   * @private
   */
  async _fetch_player_aliases(players) {
    const player_pids = players.map((player) => player.pid)

    const aliases = await db('player_aliases')
      .select('pid', 'formatted_alias')
      .whereIn('pid', player_pids)

    // Clean formatted_alias to remove null bytes that cause UTF8 encoding errors
    return aliases.map((alias) => ({
      ...alias,
      formatted_alias: clean_string(alias.formatted_alias)
    }))
  }

  /**
   * Checks if a player is considered active (not retired, not free agent)
   * @param {Object} player - Player object
   * @returns {boolean} True if player is active
   * @private
   */
  _is_active_player(player) {
    const not_retired =
      player.nfl_status !== constants.player_nfl_status.RETIRED ||
      !player.nfl_status
    const not_free_agent =
      player.current_nfl_team !== 'INA' || !player.current_nfl_team

    return not_retired && not_free_agent
  }

  /**
   * Clears all cache data
   * @private
   */
  _clear_cache() {
    this.players_by_formatted_name.clear()
    this.players_by_pid.clear()
    this.players_by_gsisid.clear()
    this.players_by_otc_id.clear()
    this.players_by_sportradar_id.clear()
    this.players_by_name_draft_year.clear()
  }

  /**
   * Builds player indexes from player data
   * @param {Array} players - Array of player objects
   * @private
   */
  _build_player_indexes(players) {
    for (const player of players) {
      this.players_by_pid.set(player.pid, player)
      this._add_player_to_name_index(player)
    }
  }

  /**
   * Builds alias indexes from alias data
   * @param {Array} aliases - Array of alias objects
   * @private
   */
  _build_alias_indexes(aliases) {
    for (const alias of aliases) {
      const player = this.players_by_pid.get(alias.pid)
      // formatted_alias is already cleaned by _fetch_player_aliases
      if (player && alias.formatted_alias) {
        this._add_player_to_name_index(player, alias.formatted_alias)
      }
    }
  }

  /**
   * Builds GSISID index from player data
   * @param {Array} players - Array of player objects
   * @private
   */
  _build_gsisid_index(players) {
    for (const player of players) {
      if (player.gsisid) {
        this.players_by_gsisid.set(player.gsisid, player)
      }
    }
  }

  /**
   * Builds Sportradar ID index from player data
   * @param {Array} players - Array of player objects
   * @private
   */
  _build_sportradar_id_index(players) {
    for (const player of players) {
      if (player.sportradar_id) {
        this.players_by_sportradar_id.set(player.sportradar_id, player)
      }
    }
  }

  /**
   * Builds OTC ID index from player data
   * @param {Array} players - Array of player objects
   * @private
   */
  _build_otc_id_index(players) {
    for (const player of players) {
      if (player.otc_id) {
        this.players_by_otc_id.set(player.otc_id, player)
      }
    }
  }

  /**
   * Builds name + draft year composite index from player data
   * @param {Array} players - Array of player objects
   * @private
   */
  _build_name_draft_index(players) {
    for (const player of players) {
      if (player.formatted && player.nfl_draft_year) {
        const key = `${format_player_name(player.formatted)}_${player.nfl_draft_year}`
        this.players_by_name_draft_year.set(key, player)
      }
    }
  }

  /**
   * Adds a player to the formatted name index
   * @param {Object} player - Player object
   * @param {string} formatted_name - Formatted name to index by (defaults to player.formatted)
   * @private
   */
  _add_player_to_name_index(player, formatted_name = player.formatted) {
    if (!formatted_name) return

    if (!this.players_by_formatted_name.has(formatted_name)) {
      this.players_by_formatted_name.set(formatted_name, [])
    }
    this.players_by_formatted_name.get(formatted_name).push(player)
  }

  /**
   * Applies filters to a list of players
   * @param {Array} players - Array of player objects
   * @param {Object} filters - Filter options
   * @returns {Array} Filtered array of players
   * @private
   */
  _apply_filters(players, { teams, ignore_free_agent, ignore_retired }) {
    let filtered_players = players

    // Filter by teams if provided
    if (teams.length > 0) {
      const formatted_teams = teams.map(fixTeam)
      filtered_players = filtered_players.filter((player) =>
        formatted_teams.includes(player.current_nfl_team)
      )
    }

    // Apply additional filters (double-check preload filters)
    if (ignore_retired) {
      filtered_players = filtered_players.filter(
        (player) => player.nfl_status !== constants.player_nfl_status.RETIRED
      )
    }

    if (ignore_free_agent) {
      filtered_players = filtered_players.filter(
        (player) => player.current_nfl_team !== 'INA'
      )
    }

    return filtered_players
  }

  /**
   * Selects the best match from filtered players
   * @param {Array} players - Array of filtered player objects
   * @param {string} formatted_name - Original formatted name searched for
   * @param {Array} teams - Teams that were searched for
   * @returns {Object|null} Best matching player or null
   * @private
   */
  _select_best_match(players, formatted_name, teams) {
    if (players.length === 0) {
      return null
    }

    if (players.length === 1) {
      return players[0]
    }

    // Multiple matches found - log warning and return first match
    log(`Multiple players found for ${formatted_name}, teams: ${teams}`)
    return players[0]
  }

  /**
   * Ensures cache is initialized before operations
   * @throws {Error} If cache not initialized
   * @private
   */
  _ensure_initialized() {
    if (!this.is_initialized) {
      throw new Error(
        'Player cache not initialized. Call preload_active_players() first.'
      )
    }
  }
}

// Create singleton instance
const player_cache = new PlayerCache()

export const preload_active_players = (options) =>
  player_cache.preload_active_players(options)
export const find_player = (params) => player_cache.find_player(params)
export const get_cache_stats = () => player_cache.get_cache_stats()

export default player_cache
