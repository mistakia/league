import debug from 'debug'

import db from '#db'
import { fixTeam, format_player_name, constants } from '#libs-shared'

const log = debug('player-cache')

class PlayerCache {
  constructor() {
    this.players_by_formatted_name = new Map()
    this.players_by_pid = new Map()
    this.is_initialized = false
  }

  async preload_active_players() {
    if (this.is_initialized) {
      log('Player cache already initialized')
      return
    }

    log('Initializing player cache...')
    console.time('player-cache-preload')

    try {
      const query = db('player')
        .select('player.*')
        .leftJoin('player_aliases', 'player.pid', 'player_aliases.pid')

      // Only load active players (not retired, not free agents)
      query.where(function () {
        this.whereNot({
          nfl_status: constants.player_nfl_status.RETIRED
        }).orWhereNull('nfl_status')
      })

      query.where(function () {
        this.whereNot({ current_nfl_team: 'INA' }).orWhereNull(
          'current_nfl_team'
        )
      })

      const player_rows = await query

      // Clear existing cache
      this.players_by_formatted_name.clear()
      this.players_by_pid.clear()

      // Build cache indexes
      for (const player of player_rows) {
        this.players_by_pid.set(player.pid, player)

        // Index by formatted name
        if (player.formatted) {
          if (!this.players_by_formatted_name.has(player.formatted)) {
            this.players_by_formatted_name.set(player.formatted, [])
          }
          this.players_by_formatted_name.get(player.formatted).push(player)
        }

        // Index by formatted alias if available
        if (player.formatted_alias) {
          if (!this.players_by_formatted_name.has(player.formatted_alias)) {
            this.players_by_formatted_name.set(player.formatted_alias, [])
          }
          this.players_by_formatted_name
            .get(player.formatted_alias)
            .push(player)
        }
      }

      this.is_initialized = true
      console.timeEnd('player-cache-preload')
      log(`Player cache initialized with ${player_rows.length} active players`)
    } catch (error) {
      log(`Error initializing player cache: ${error.message}`)
      throw error
    }
  }

  find_player({
    name,
    teams = [],
    ignore_free_agent = true,
    ignore_retired = true
  }) {
    if (!this.is_initialized) {
      throw new Error(
        'Player cache not initialized. Call preload_active_players() first.'
      )
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

    // Filter by teams if provided
    let filtered_players = potential_players
    if (teams.length > 0) {
      const formatted_teams = teams.map(fixTeam)
      filtered_players = potential_players.filter((player) =>
        formatted_teams.includes(player.current_nfl_team)
      )
    }

    // Apply additional filters (these should already be filtered during preload, but double-check)
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

    if (filtered_players.length === 1) {
      return filtered_players[0]
    }

    if (filtered_players.length > 1) {
      log(`Multiple players found for ${formatted_name}, teams: ${teams}`)
      return filtered_players[0] // Return first match for consistency
    }

    return null
  }

  get_cache_stats() {
    return {
      is_initialized: this.is_initialized,
      total_players: this.players_by_pid.size,
      formatted_name_entries: this.players_by_formatted_name.size
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
