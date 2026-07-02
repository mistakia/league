import debug from 'debug'

import db from '#db'
import { LeagueConfigMapper } from '#libs-server/external-fantasy-leagues/mappers/index.mjs'
import {
  find_or_create_scoring_format,
  find_or_create_league_format
} from '#libs-server/find-or-create-format.mjs'
import SyncUtils from './sync-utils.mjs'

const log = debug('external:config-sync')

/**
 * Configuration sync module
 * Handles syncing league configuration and scoring formats from external platforms
 *
 * Responsibilities:
 * - Fetch league configuration and scoring format from external platform
 * - Map external format to internal canonical format
 * - Resolve format identities via DB upsert (opaque IDs; full config tuple is the dedup oracle)
 * - Update season records with the resolved format IDs
 */
export class ConfigSync {
  constructor() {
    this.league_mapper = new LeagueConfigMapper()
    this.sync_utils = new SyncUtils()
  }

  async sync_league_config({
    adapter,
    sync_context,
    progress_callback = null,
    sync_stats_errors = []
  }) {
    try {
      log(`Syncing league configuration for ${sync_context.platform}`)

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

      const { scoring_params, league_params } =
        this.league_mapper.map_league_config({
          platform: sync_context.platform,
          league_config: external_league,
          scoring_config: external_scoring,
          roster_config:
            external_league.roster_settings || external_league.settings
        })

      const scoring_format_id = await find_or_create_scoring_format(
        db,
        scoring_params
      )
      const league_format_id = await find_or_create_league_format(db, {
        ...league_params,
        scoring_format_id
      })

      await db('seasons')
        .where({
          lid: sync_context.internal_league_id,
          year: sync_context.year
        })
        .update({
          league_format_id,
          scoring_format_id
        })

      if (progress_callback) {
        await progress_callback('League configuration synced', 23, {
          step: 'league_config',
          league_format_id,
          scoring_format_id
        })
      }

      log(`Updated league configuration with format IDs`)

      return {
        success: true,
        league_format_id,
        scoring_format_id
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
}

export default ConfigSync
