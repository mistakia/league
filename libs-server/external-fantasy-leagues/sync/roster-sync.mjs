import debug from 'debug'

import db from '#db'
import { roster_slot_types, player_tag_types } from '#constants'
import { PlayerIdMapper } from '../mappers/index.mjs'
import SyncUtils from './sync-utils.mjs'

const log = debug('external:roster-sync')

/**
 * Roster sync module
 * Handles syncing roster data and player mappings from external platforms
 *
 * Responsibilities:
 * - Fetch roster data from external platform
 * - Map external player IDs to internal player IDs (PIDs)
 * - Sync roster composition (add/remove players) for each team
 * - Maintain idempotent operations (safe to run multiple times)
 */
export class RosterSync {
  constructor() {
    this.player_mapper = new PlayerIdMapper()
    this.sync_utils = new SyncUtils()
  }

  /**
   * Sync rosters from external platform
   * @param {Object} options - Roster sync options
   * @param {Object} options.adapter - Platform adapter instance
   * @param {Object} options.sync_context - Sync context with league and platform info
   * @param {Object} options.sync_stats - Sync statistics object
   * @param {Function} [options.progress_callback] - Optional progress reporting callback
   * @param {Array} [options.sync_stats_errors] - Array to collect sync errors
   * @returns {Promise<Object>} Roster sync results
   */
  async sync_rosters({
    adapter,
    sync_context,
    sync_stats,
    progress_callback = null,
    sync_stats_errors = []
  }) {
    try {
      log(`Syncing rosters for ${sync_context.platform}`)

      const external_rosters = await adapter.get_rosters({
        league_id: sync_context.external_league_id,
        week: sync_context.week
      })

      if (progress_callback) {
        await progress_callback('Retrieved roster data', 45, {
          step: 'rosters',
          roster_count: external_rosters?.length || 0
        })
      }

      // Map players first
      await this._setup_player_mappings({
        adapter,
        sync_context,
        sync_stats
      })

      const rosters = external_rosters || []
      let processed_rosters = 0

      for (const external_roster of rosters) {
        if (progress_callback && rosters.length > 0) {
          const roster_progress = 45 + (processed_rosters / rosters.length) * 20 // 45-65%
          await progress_callback(
            `Processing roster ${processed_rosters + 1}/${rosters.length}`,
            Math.round(roster_progress),
            {
              step: 'rosters',
              team_id:
                external_roster.team_external_id ||
                external_roster.roster_id ||
                external_roster.team_id,
              processed: processed_rosters,
              total: rosters.length
            }
          )
        }

        await this.sync_single_roster({ external_roster, sync_context })
        processed_rosters++
      }

      sync_stats.rosters_updated += processed_rosters

      if (progress_callback) {
        await progress_callback('Rosters synchronized', 68, {
          step: 'rosters',
          rosters_processed: processed_rosters,
          players_mapped: sync_stats.players_mapped
        })
      }

      log(`Synced ${rosters.length} rosters`)

      return {
        success: true,
        rosters_processed: rosters.length,
        players_mapped: sync_context.player_mappings.size
      }
    } catch (error) {
      log(`Error syncing rosters: ${error.message}`)
      const sync_error = this.sync_utils.create_sync_error({
        error_type: 'roster_sync_failure',
        error_message: error.message,
        step: 'sync_rosters',
        context_data: {
          platform: sync_context.platform,
          external_league_id: sync_context.external_league_id,
          week: sync_context.week
        }
      })
      sync_stats_errors.push(sync_error)
      throw error
    }
  }

  /**
   * Sync single roster
   * @param {Object} options - Single roster sync options
   * @param {Object} options.external_roster - External roster data
   * @param {Object} options.sync_context - Sync context with league and platform info
   * @returns {Promise<void>}
   */
  async sync_single_roster({ external_roster, sync_context }) {
    const external_team_id = this._extract_team_id({ external_roster })
    const internal_team_id = sync_context.team_mappings.get(external_team_id)

    if (!internal_team_id) {
      log(`No team mapping found for external team: ${external_team_id}`)
      return
    }

    // Get current internal roster
    const current_roster = await this._get_current_roster({
      internal_league_id: sync_context.internal_league_id,
      internal_team_id,
      week: sync_context.week,
      year: sync_context.year
    })

    const current_pids = new Set(
      current_roster.map((roster_entry) => roster_entry.pid)
    )
    const external_pids = new Set()

    // Process external roster players
    const roster_players = this._extract_roster_players({ external_roster })

    for (const external_player_id of roster_players) {
      const pid = sync_context.player_mappings.get(external_player_id)
      if (pid) {
        external_pids.add(pid)

        // Add player to roster if not already there (idempotent)
        if (!current_pids.has(pid)) {
          await this._add_player_to_roster({
            internal_league_id: sync_context.internal_league_id,
            internal_team_id,
            pid,
            week: sync_context.week,
            year: sync_context.year
          })
        }
      }
    }

    // Remove players no longer on external roster
    await this._remove_obsolete_players({
      current_pids,
      external_pids,
      internal_league_id: sync_context.internal_league_id,
      internal_team_id,
      week: sync_context.week,
      year: sync_context.year
    })
  }

  /**
   * Setup player mappings from external players
   * @param {Object} options - Player mapping setup options
   * @param {Object} options.adapter - Platform adapter instance
   * @param {Object} options.sync_context - Sync context
   * @param {Object} options.sync_stats - Sync statistics object
   * @returns {Promise<void>}
   * @private
   */
  async _setup_player_mappings({ adapter, sync_context, sync_stats }) {
    const external_players = await adapter.get_players()

    // Build player mapping context
    const player_mapping_context = this._build_player_mapping_context({
      external_players
    })

    // Map all external player IDs to internal PIDs
    const player_mappings = await this.player_mapper.bulk_map_to_internal({
      platform: sync_context.platform,
      players: player_mapping_context.players
    })

    // Store player mappings in context
    for (const [external_id, pid] of player_mappings) {
      if (pid) {
        sync_context.player_mappings.set(external_id, pid)
      }
    }

    sync_stats.players_mapped = sync_context.player_mappings.size
  }

  /**
   * Build player mapping context from external players
   * @param {Object} options - Context building options
   * @param {Array} options.external_players - Array of external player data
   * @returns {Object} Player mapping context
   * @private
   */
  _build_player_mapping_context({ external_players }) {
    return {
      players: external_players.map((external_player) => ({
        external_id: external_player.player_id || external_player.id,
        fallback_data: {
          name:
            external_player.full_name ||
            `${external_player.first_name} ${external_player.last_name}`,
          position: external_player.position,
          team: external_player.team || external_player.nfl_team
        }
      }))
    }
  }

  /**
   * Extract team ID from external roster (canonical format)
   * @param {Object} options - Team ID extraction options
   * @param {Object} options.external_roster - External roster data in canonical format
   * @returns {string} External team ID
   * @private
   */
  _extract_team_id({ external_roster }) {
    // Canonical format uses team_external_id
    return (
      external_roster.team_external_id ||
      external_roster.roster_id ||
      external_roster.team_id
    )
  }

  /**
   * Extract roster players from external roster
   * @param {Object} options - Roster players extraction options
   * @param {Object} options.external_roster - External roster data
   * @returns {Array} Array of external player IDs
   * @private
   */
  _extract_roster_players({ external_roster }) {
    return external_roster.players || external_roster.roster || []
  }

  /**
   * Get current roster from database
   * @param {Object} options - Current roster retrieval options
   * @param {string} options.internal_league_id - Internal league ID
   * @param {string} options.internal_team_id - Internal team ID
   * @param {number} options.week - Week number
   * @param {number} options.year - Season year
   * @returns {Promise<Array>} Current roster entries
   * @private
   */
  async _get_current_roster({
    internal_league_id,
    internal_team_id,
    week,
    year
  }) {
    return await db('rosters_players').where({
      lid: internal_league_id,
      tid: internal_team_id,
      week,
      year
    })
  }

  /**
   * Add player to roster
   * @param {Object} options - Player addition options
   * @param {string} options.internal_league_id - Internal league ID
   * @param {string} options.internal_team_id - Internal team ID
   * @param {string} options.pid - Player ID
   * @param {number} options.week - Week number
   * @param {number} options.year - Season year
   * @returns {Promise<void>}
   * @private
   */
  async _add_player_to_roster({
    internal_league_id,
    internal_team_id,
    pid,
    week,
    year
  }) {
    await db('rosters_players')
      .insert({
        lid: internal_league_id,
        tid: internal_team_id,
        pid,
        slot: roster_slot_types.BENCH, // Default to bench
        pos: 'BENCH',
        week,
        year,
        extensions: 0,
        tag: player_tag_types.REGULAR
      })
      .onConflict(['lid', 'tid', 'pid', 'week', 'year'])
      .ignore()
  }

  /**
   * Remove players no longer on external roster
   * @param {Object} options - Player removal options
   * @param {Set} options.current_pids - Set of current player IDs
   * @param {Set} options.external_pids - Set of external player IDs
   * @param {string} options.internal_league_id - Internal league ID
   * @param {string} options.internal_team_id - Internal team ID
   * @param {number} options.week - Week number
   * @param {number} options.year - Season year
   * @returns {Promise<void>}
   * @private
   */
  async _remove_obsolete_players({
    current_pids,
    external_pids,
    internal_league_id,
    internal_team_id,
    week,
    year
  }) {
    const players_to_remove = [...current_pids].filter(
      (pid) => !external_pids.has(pid)
    )

    if (players_to_remove.length > 0) {
      await db('rosters_players')
        .where({
          lid: internal_league_id,
          tid: internal_team_id,
          week,
          year
        })
        .whereIn('pid', players_to_remove)
        .del()
    }
  }
}

export default RosterSync
