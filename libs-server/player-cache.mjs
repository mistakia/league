import debug from 'debug'

import db from '#db'
import { fixTeam, format_player_name, constants } from '#libs-shared'

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
    this.is_initialized = false
  }

  /**
   * Preloads all active players and their aliases into memory cache
   * @throws {Error} If database query fails
   */
  async preload_active_players() {
    if (this.is_initialized) {
      log('Player cache already initialized')
      return
    }

    log('Initializing player cache...')
    console.time('player-cache-preload')

    try {
      const active_players = await this._fetch_active_players()
      const player_aliases = await this._fetch_player_aliases(active_players)

      this._clear_cache()
      this._build_player_indexes(active_players)
      this._build_alias_indexes(player_aliases)
      this._build_gsisid_index(active_players)

      this.is_initialized = true
      console.timeEnd('player-cache-preload')
      log(
        `Player cache initialized with ${active_players.length} active players`
      )
    } catch (error) {
      log(`Error initializing player cache: ${error.message}`)
      throw error
    }
  }

  /**
   * Finds a player by name with optional team filtering
   * @param {Object} params - Search parameters
   * @param {string} params.name - Player name to search for
   * @param {string[]} params.teams - Optional team abbreviations to filter by
   * @param {boolean} params.ignore_free_agent - Whether to exclude free agents (default: true)
   * @param {boolean} params.ignore_retired - Whether to exclude retired players (default: true)
   * @returns {Object|null} Player object if found, null otherwise
   * @throws {Error} If cache not initialized
   */
  find_player({
    name,
    gsisid,
    teams = [],
    ignore_free_agent = true,
    ignore_retired = true
  }) {
    this._ensure_initialized()

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
      gsisid_entries: this.players_by_gsisid.size
    }
  }

  // Private methods

  /**
   * Fetches all active players from database
   * @returns {Promise<Array>} Array of active player objects
   * @private
   */
  async _fetch_active_players() {
    const all_players = await db('player').select('*')

    return all_players.filter((player) => this._is_active_player(player))
  }

  /**
   * Fetches aliases for given players
   * @param {Array} players - Array of player objects
   * @returns {Promise<Array>} Array of alias objects
   * @private
   */
  async _fetch_player_aliases(players) {
    const player_pids = players.map((player) => player.pid)

    return await db('player_aliases')
      .select('pid', 'formatted_alias')
      .whereIn('pid', player_pids)
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

export const preload_active_players = () =>
  player_cache.preload_active_players()
export const find_player = (params) => player_cache.find_player(params)
export const get_cache_stats = () => player_cache.get_cache_stats()

export default player_cache
