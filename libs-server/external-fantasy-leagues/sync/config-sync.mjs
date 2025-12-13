import debug from 'debug'

import db from '#db'
import { LeagueConfigMapper } from '../mappers/index.mjs'
import SyncUtils from './sync-utils.mjs'

const log = debug('external:config-sync')

/**
 * Configuration sync module
 * Handles syncing league configuration and scoring formats from external platforms
 *
 * Responsibilities:
 * - Fetch league configuration and scoring format from external platform
 * - Map external format to internal canonical format
 * - Store league and scoring formats in database (idempotent)
 * - Update season records with format hash references
 */
export class ConfigSync {
  constructor() {
    this.league_mapper = new LeagueConfigMapper()
    this.sync_utils = new SyncUtils()
  }

  /**
   * Sync league configuration and format
   * @param {Object} options - Configuration sync options
   * @param {Object} options.adapter - Platform adapter instance
   * @param {Object} options.sync_context - Sync context with league and platform info
   * @param {Function} [options.progress_callback] - Optional progress reporting callback
   * @param {Array} [options.sync_stats_errors] - Array to collect sync errors
   * @returns {Promise<Object>} Configuration sync results
   */
  async sync_league_config({
    adapter,
    sync_context,
    progress_callback = null,
    sync_stats_errors = []
  }) {
    try {
      log(`Syncing league configuration for ${sync_context.platform}`)

      // Get external league data
      const external_league = await adapter.get_league(
        sync_context.external_league_id
      )

      if (progress_callback) {
        await progress_callback('Retrieved league configuration', 18, {
          step: 'league_config',
          league_name: external_league?.name || 'Unknown'
        })
      }

      const external_scoring = await adapter.get_scoring_format(
        sync_context.external_league_id
      )

      if (progress_callback) {
        await progress_callback('Retrieved scoring configuration', 20, {
          step: 'league_config',
          scoring_type: external_scoring?.type || 'standard'
        })
      }

      // Map to internal format
      const { league_format, scoring_format } = await this._map_league_config({
        platform_name: sync_context.platform,
        league_config: external_league,
        scoring_config: external_scoring,
        roster_config:
          external_league.roster_settings || external_league.settings
      })

      // Store or update league formats (idempotent)
      await this._store_league_formats({
        league_format,
        scoring_format
      })

      // Update season with format hashes
      await this._update_season_formats({
        internal_league_id: sync_context.internal_league_id,
        year: sync_context.year,
        league_format_hash: league_format.league_format_hash,
        scoring_format_hash: scoring_format.scoring_format_hash
      })

      if (progress_callback) {
        await progress_callback('League configuration synced', 23, {
          step: 'league_config',
          league_format_hash: league_format.league_format_hash.substring(0, 8),
          scoring_format_hash: scoring_format.scoring_format_hash.substring(
            0,
            8
          )
        })
      }

      log(`Updated league configuration with format hashes`)

      return {
        success: true,
        league_format_hash: league_format.league_format_hash,
        scoring_format_hash: scoring_format.scoring_format_hash
      }
    } catch (error) {
      log(`Error syncing league config: ${error.message}`)
      const sync_error = this.sync_utils.create_sync_error({
        error_type: 'config_sync_failure',
        error_message: error.message,
        step: 'sync_league_config',
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
   * Map external league configuration to internal format
   * @param {Object} options - Mapping options
   * @param {string} options.platform_name - Platform identifier
   * @param {Object} options.league_config - External league configuration
   * @param {Object} options.scoring_config - External scoring configuration
   * @param {Object} options.roster_config - External roster configuration
   * @returns {Promise<Object>} Mapped league and scoring formats
   * @private
   */
  async _map_league_config({
    platform_name,
    league_config,
    scoring_config,
    roster_config
  }) {
    return this.league_mapper.map_league_config({
      platform: platform_name,
      league_config,
      scoring_config,
      roster_config
    })
  }

  /**
   * Store league formats in database
   * @param {Object} options - Storage options
   * @param {Object} options.league_format - League format data
   * @param {Object} options.scoring_format - Scoring format data
   * @returns {Promise<void>}
   * @private
   */
  async _store_league_formats({ league_format, scoring_format }) {
    await db('league_formats')
      .insert(league_format)
      .onConflict('league_format_hash')
      .ignore()

    await db('league_scoring_formats')
      .insert(scoring_format)
      .onConflict('scoring_format_hash')
      .ignore()
  }

  /**
   * Update season with format hashes
   * @param {Object} options - Update options
   * @param {string} options.internal_league_id - Internal league ID
   * @param {number} options.year - Season year
   * @param {string} options.league_format_hash - League format hash
   * @param {string} options.scoring_format_hash - Scoring format hash
   * @returns {Promise<void>}
   * @private
   */
  async _update_season_formats({
    internal_league_id,
    year,
    league_format_hash,
    scoring_format_hash
  }) {
    await db('seasons')
      .where({
        lid: internal_league_id,
        year
      })
      .update({
        league_format_hash,
        scoring_format_hash
      })
  }
}

export default ConfigSync
