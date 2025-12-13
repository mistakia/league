import debug from 'debug'

import SyncUtils from './sync-utils.mjs'

const log = debug('external:team-sync')

/**
 * Team sync module
 * Handles syncing team data and mapping external team IDs to internal ones
 *
 * Responsibilities:
 * - Fetch team data from external platform
 * - Create mappings between external team IDs and internal team IDs
 * - Update sync context with team mappings for use by other sync modules
 *
 * Note: Currently creates mappings assuming teams already exist in the internal system.
 * The map_external_team_id() method is a placeholder that returns the external ID.
 * Future enhancement: Automatically create teams if they don't exist.
 */
export class TeamSync {
  constructor() {
    this.sync_utils = new SyncUtils()
  }

  /**
   * Sync teams from external platform
   * @param {Object} options - Team sync options
   * @param {Object} options.adapter - Platform adapter instance
   * @param {Object} options.sync_context - Sync context with league and platform info
   * @param {Function} [options.progress_callback] - Optional progress reporting callback
   * @param {Array} [options.sync_stats_errors] - Array to collect sync errors
   * @returns {Promise<Object>} Team sync results
   */
  async sync_teams({
    adapter,
    sync_context,
    progress_callback = null,
    sync_stats_errors = []
  }) {
    try {
      log(`Syncing teams for ${sync_context.platform}`)

      const external_teams = await adapter.get_teams(
        sync_context.external_league_id
      )

      if (progress_callback) {
        await progress_callback('Retrieved team data', 30, {
          step: 'teams',
          team_count: external_teams?.length || 0
        })
      }

      const team_mappings = await this._process_team_mappings({
        external_teams,
        sync_context,
        progress_callback
      })

      // Update sync context with team mappings
      sync_context.team_mappings = team_mappings

      if (progress_callback) {
        await progress_callback('Teams synchronized', 38, {
          step: 'teams',
          teams_processed: external_teams?.length || 0
        })
      }

      log(`Mapped ${external_teams?.length || 0} teams`)

      return {
        success: true,
        teams_processed: external_teams?.length || 0,
        team_mappings
      }
    } catch (error) {
      log(`Error syncing teams: ${error.message}`)
      const sync_error = this.sync_utils.create_sync_error({
        error_type: 'team_sync_failure',
        error_message: error.message,
        step: 'sync_teams',
        context_data: {
          platform: sync_context.platform,
          external_league_id: sync_context.external_league_id
        }
      })
      sync_stats_errors.push(sync_error)
      throw error
    }
  }

  /**
   * Map external team ID to internal team ID
   * @param {Object} options - Team mapping options
   * @param {string} options.external_team_id - External team identifier
   * @param {Object} [options.sync_context] - Sync context for additional mapping logic
   * @returns {string} Internal team identifier
   *
   * Note: This is a placeholder implementation. In a full implementation, this would:
   * 1. Look up existing team mappings in the database
   * 2. Create teams if they don't exist
   * 3. Handle team name matching and deduplication
   */
  map_external_team_id({ external_team_id, sync_context = null }) {
    // Placeholder: assumes external_team_id matches internal team ID
    // TODO: Implement proper team mapping via database lookup
    return external_team_id
  }

  /**
   * Extract external team ID from team data (canonical format)
   * @param {Object} options - Team ID extraction options
   * @param {Object} options.external_team - External team data object in canonical format
   * @returns {string} External team identifier
   */
  extract_external_team_id({ external_team }) {
    // Canonical format uses external_team_id (for team format) or team_external_id (for league format teams array)
    return (
      external_team.external_team_id ||
      external_team.team_external_id ||
      external_team.roster_id ||
      external_team.team_id ||
      external_team.id
    )
  }

  /**
   * Process team mappings for all external teams
   * @param {Object} options - Processing options
   * @param {Array} options.external_teams - Array of external team data
   * @param {Object} options.sync_context - Sync context
   * @param {Function} [options.progress_callback] - Optional progress reporting callback
   * @returns {Promise<Map>} Team mappings (external_id -> internal_id)
   * @private
   */
  async _process_team_mappings({
    external_teams,
    sync_context,
    progress_callback = null
  }) {
    const team_mappings = new Map()
    let processed_teams = 0
    const teams = external_teams || []

    for (const external_team of teams) {
      const external_team_id = this.extract_external_team_id({ external_team })

      // For now, we'll assume teams already exist and just create mappings
      // In a full implementation, you might create teams if they don't exist
      const internal_team_id = this.map_external_team_id({
        external_team_id
      })

      team_mappings.set(external_team_id, internal_team_id)
      processed_teams++

      if (progress_callback && teams.length > 0) {
        const team_progress = 30 + (processed_teams / teams.length) * 8 // 30-38%
        await progress_callback(
          `Processing team ${processed_teams}/${teams.length}`,
          Math.round(team_progress),
          {
            step: 'teams',
            team_name: external_team.name || `Team ${external_team_id}`,
            processed: processed_teams,
            total: teams.length
          }
        )
      }
    }

    return team_mappings
  }
}

export default TeamSync
