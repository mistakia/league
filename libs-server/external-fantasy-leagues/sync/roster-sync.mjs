import debug from 'debug'

import db from '#db'
import { roster_slot_types, player_tag_types } from '#constants'
import { PlayerIdMapper } from '#libs-server/external-fantasy-leagues/mappers/index.mjs'
import SyncUtils from './sync-utils.mjs'

const log = debug('external:roster-sync')

// Key inside the canonical `player_ids` object that carries a platform's OWN
// player identifier (schemas/canonical-player-format.json, mirrored in
// canonical-roster-format.json). The key is not derivable from the platform
// name -- RTSPORTS stores its id under `rts_id` -- and the canonical format
// defines no player-id key at all for FFPC, NFFC or FANTRAX, so those platforms
// cannot be mapped by id and are rejected rather than silently keyed undefined.
const PLATFORM_PLAYER_ID_KEYS = {
  sleeper: 'sleeper_id',
  espn: 'espn_id',
  yahoo: 'yahoo_id',
  mfl: 'mfl_id',
  cbs: 'cbs_id',
  fleaflicker: 'fleaflicker_id',
  nfl: 'nfl_id',
  rtsports: 'rts_id'
}

// Internal roster slot for each canonical `roster_slot_category`. A STARTING
// entry cannot become a starting slot here: resolving one needs the league's
// position settings, which no adapter reads -- sleeper's
// determine_roster_slot_info returns `slot: null` for that category -- so a
// starter is imported onto the bench exactly like a bench player. IR and
// practice squad DO survive, because the adapter resolves those from the
// platform's own reserve/taxi lists.
const ROSTER_SLOT_BY_CATEGORY = {
  STARTING: roster_slot_types.BENCH,
  BENCH: roster_slot_types.BENCH,
  INJURED_RESERVE: roster_slot_types.RESERVE_SHORT_TERM,
  PRACTICE_SQUAD: roster_slot_types.PS
}

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
   * @param {object} options - Roster sync options
   * @param {object} options.adapter - Platform adapter instance
   * @param {object} options.sync_context - Sync context with league and platform info
   * @param {object} options.sync_stats - Sync statistics object
   * @param {(message: string, progress: number, detail: object) => Promise<void>} [options.progress_callback] - Optional progress reporting callback
   * @param {object[]} [options.sync_stats_errors] - Array to collect sync errors
   * @returns {Promise<void>}
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
        week: sync_context.week,
        year: sync_context.year
      })

      const rosters = external_rosters || []

      if (progress_callback) {
        await progress_callback('Retrieved roster data', 45, {
          step: 'rosters',
          roster_count: rosters.length
        })
      }

      // Map players first
      await this._setup_player_mappings({
        adapter,
        sync_context,
        sync_stats,
        rosters
      })

      let processed_rosters = 0
      let synced_rosters = 0

      for (const external_roster of rosters) {
        if (progress_callback) {
          const roster_progress = 45 + (processed_rosters / rosters.length) * 20 // 45-65%
          await progress_callback(
            `Processing roster ${processed_rosters + 1}/${rosters.length}`,
            Math.round(roster_progress),
            {
              step: 'rosters',
              team_id: this._extract_team_id({ external_roster }),
              processed: processed_rosters,
              total: rosters.length
            }
          )
        }

        const roster_synced = await this.sync_single_roster({
          external_roster,
          sync_context,
          sync_stats_errors
        })
        if (roster_synced) {
          synced_rosters++
        }
        processed_rosters++
      }

      // Only rosters that actually reached the database count as updated -- a
      // skipped roster is reported through sync_stats_errors instead.
      sync_stats.rosters_updated += synced_rosters

      if (progress_callback) {
        await progress_callback('Rosters synchronized', 68, {
          step: 'rosters',
          rosters_processed: processed_rosters,
          rosters_synced: synced_rosters,
          players_mapped: sync_stats.players_mapped
        })
      }

      log(`Synced ${synced_rosters} of ${rosters.length} rosters`)
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
   * @param {object} options - Single roster sync options
   * @param {object} options.external_roster - External roster data
   * @param {object} options.sync_context - Sync context with league and platform info
   * @param {object[]} [options.sync_stats_errors] - Array to collect sync errors
   * @returns {Promise<boolean>} True when the roster was written to the database
   */
  async sync_single_roster({
    external_roster,
    sync_context,
    sync_stats_errors = []
  }) {
    const external_team_id = this._extract_team_id({ external_roster })
    const internal_team_id = sync_context.team_mappings.get(external_team_id)

    if (!internal_team_id) {
      return this._skip_roster({
        sync_stats_errors,
        sync_context,
        external_team_id,
        error_type: 'roster_team_mapping_missing',
        error_message: `No team mapping found for external team ${external_team_id}`
      })
    }

    // `rosters_players.roster_id` is NOT NULL and half the primary key, so the
    // week's `rosters` row has to exist before any player can be written. It is
    // created by league setup, never here.
    const roster_row = await db('rosters')
      .where({
        lid: sync_context.internal_league_id,
        tid: internal_team_id,
        week: sync_context.week,
        season_year: sync_context.year
      })
      .first()

    if (!roster_row) {
      return this._skip_roster({
        sync_stats_errors,
        sync_context,
        external_team_id,
        error_type: 'roster_row_missing',
        error_message: `No rosters row for team ${internal_team_id} in week ${sync_context.week} of ${sync_context.year}`
      })
    }

    const roster_entries = this._extract_roster_players({
      external_roster,
      platform: sync_context.platform
    })

    const slots_by_pid = new Map()
    const unmapped_external_player_ids = []

    for (const roster_entry of roster_entries) {
      const pid = sync_context.player_mappings.get(
        roster_entry.external_player_id
      )
      if (pid) {
        slots_by_pid.set(pid, roster_entry.slot)
      } else {
        unmapped_external_player_ids.push(
          String(roster_entry.external_player_id)
        )
      }
    }

    // An external player the mapper could not resolve is indistinguishable from
    // a player who left the roster, and the removal below is a hard delete of
    // internal rows -- so an incomplete mapping must suppress the REMOVAL, not
    // the whole roster. Writing the players that did resolve is safe either way,
    // and abandoning the team instead makes one unresolvable player (an IDP, a
    // DST, an unsigned rookie -- and `map_to_internal` also returns null for a
    // caught exception) mean that team never syncs at all.
    const player_mapping_is_complete = unmapped_external_player_ids.length === 0
    if (!player_mapping_is_complete) {
      this._record_roster_error({
        sync_stats_errors,
        sync_context,
        external_team_id,
        error_type: 'roster_player_mapping_missing',
        error_message: `Unmapped external players on team ${internal_team_id}, skipping removals: ${unmapped_external_player_ids.join(', ')}`
      })
    }

    // The adds and the delete are one unit: a failure part way through the adds
    // would otherwise leave the team half-migrated, and the delete is not
    // recoverable.
    await db.transaction(async (trx) => {
      const current_roster_rows = await trx('rosters_players')
        .where({ roster_id: roster_row.roster_id })
        .select('pid', 'slot')
      const slot_by_current_pid = new Map(
        current_roster_rows.map((roster_player_row) => [
          roster_player_row.pid,
          roster_player_row.slot
        ])
      )

      const pids_to_add = [...slots_by_pid.keys()].filter(
        (pid) => !slot_by_current_pid.has(pid)
      )
      // A player already on the roster whose external slot changed -- promoted
      // off the taxi squad, moved to IR -- needs the new slot written. Adding
      // only new pids would leave the mapped slot correct on the first sync and
      // permanently stale on every one after it.
      const pids_to_reslot = [...slots_by_pid.keys()].filter(
        (pid) =>
          slot_by_current_pid.has(pid) &&
          slot_by_current_pid.get(pid) !== slots_by_pid.get(pid)
      )
      const pids_to_remove = [...slot_by_current_pid.keys()].filter(
        (pid) => !slots_by_pid.has(pid)
      )

      // `rosters_players.player_position` holds the player's primary position
      // and is NOT NULL under a vocabulary CHECK. Every pid here came from a
      // `player` row the mapper resolved, so the lookup always finds one.
      const positions_by_pid = new Map(
        (
          await trx('player')
            .whereIn('pid', pids_to_add)
            .select('pid', 'primary_position')
        ).map((player_row) => [player_row.pid, player_row.primary_position])
      )

      for (const pid of pids_to_add) {
        await trx('rosters_players')
          .insert({
            roster_id: roster_row.roster_id,
            lid: sync_context.internal_league_id,
            tid: internal_team_id,
            pid,
            slot: slots_by_pid.get(pid),
            player_position: positions_by_pid.get(pid),
            week: sync_context.week,
            season_year: sync_context.year,
            extensions: 0,
            tag: player_tag_types.REGULAR
          })
          // (roster_id, pid) is the primary key -- the only conflict target the
          // table can arbitrate for this insert.
          .onConflict(['roster_id', 'pid'])
          .ignore()
      }

      for (const pid of pids_to_reslot) {
        await trx('rosters_players')
          .where({ roster_id: roster_row.roster_id, pid })
          .update({ slot: slots_by_pid.get(pid) })
      }

      // Only when every external player resolved: a pid absent from an
      // incomplete mapping may be present on the external roster under an id we
      // failed to resolve, and this delete cannot be undone.
      if (player_mapping_is_complete && pids_to_remove.length > 0) {
        await trx('rosters_players')
          .where({ roster_id: roster_row.roster_id })
          .whereIn('pid', pids_to_remove)
          .del()
      }
    })

    return true
  }

  /**
   * Record a roster that could not be synced and leave its internal rows alone
   * @param {object} options - Skip options
   * @param {object[]} options.sync_stats_errors - Array to collect sync errors
   * @param {object} options.sync_context - Sync context with league and platform info
   * @param {string} options.external_team_id - External team ID of the skipped roster
   * @param {string} options.error_type - Sync error type
   * @param {string} options.error_message - Human readable reason
   * @returns {boolean} Always false, so callers can `return this._skip_roster(...)`
   * @private
   */
  _skip_roster({
    sync_stats_errors,
    sync_context,
    external_team_id,
    error_type,
    error_message
  }) {
    this._record_roster_error({
      sync_stats_errors,
      sync_context,
      external_team_id,
      error_type,
      error_message
    })
    return false
  }

  /**
   * Record a sync error without abandoning the roster
   *
   * Separate from `_skip_roster` because not every problem is fatal to the
   * roster: an unresolvable external player suppresses the removal step and
   * still lets the resolvable players be written.
   *
   * @param {object} options - same shape as `_skip_roster`
   * @private
   */
  _record_roster_error({
    sync_stats_errors,
    sync_context,
    external_team_id,
    error_type,
    error_message
  }) {
    log(error_message)
    sync_stats_errors.push(
      this.sync_utils.create_sync_error({
        error_type,
        error_message,
        step: 'sync_single_roster',
        context_data: {
          platform: sync_context.platform,
          external_league_id: sync_context.external_league_id,
          external_team_id,
          week: sync_context.week
        }
      })
    )
  }

  /**
   * Setup player mappings from external players
   * @param {object} options - Player mapping setup options
   * @param {object} options.adapter - Platform adapter instance
   * @param {object} options.sync_context - Sync context
   * @param {object} options.sync_stats - Sync statistics object
   * @param {object[]} options.rosters - External rosters in canonical format
   * @returns {Promise<void>}
   * @private
   */
  async _setup_player_mappings({ adapter, sync_context, sync_stats, rosters }) {
    const player_catalog = await adapter.get_players()

    // Platform player endpoints are global (Sleeper's is the whole ~11k entry
    // NFL catalog) and bulk_map_to_internal issues one sequential database
    // lookup per entry, so narrow to the players actually on a roster in this
    // league first -- the same trim the read-only fetch path applies.
    const external_players = this.sync_utils.filter_players_to_rostered({
      players: player_catalog,
      rosters
    })

    const player_mappings = await this.player_mapper.bulk_map_to_internal({
      platform: sync_context.platform,
      players: this._build_player_mapping_inputs({
        external_players,
        platform: sync_context.platform
      })
    })

    for (const [external_id, pid] of player_mappings) {
      if (pid) {
        sync_context.player_mappings.set(external_id, pid)
      }
    }

    sync_stats.players_mapped = sync_context.player_mappings.size
  }

  /**
   * Build bulk_map_to_internal inputs from canonical external players
   * @param {object} options - Input building options
   * @param {object[]} options.external_players - External players in canonical format
   * @param {string} options.platform - Platform identifier
   * @returns {object[]} Array of `{ external_id, fallback_data }` mapping inputs
   * @private
   */
  _build_player_mapping_inputs({ external_players, platform }) {
    const player_id_key = this._get_platform_player_id_key({ platform })

    return external_players
      .map((external_player) => ({
        external_id: external_player.player_ids?.[player_id_key],
        fallback_data: {
          name: this._build_player_name({ external_player }),
          position: external_player.position,
          team: external_player.team_abbreviation
        }
      }))
      .filter((mapping_input) => mapping_input.external_id != null)
  }

  /**
   * Build a search name for fallback player matching
   * @param {object} options - Name building options
   * @param {object} options.external_player - External player in canonical format
   * @returns {string|null} Player name, or null when the player carries no name
   * @private
   */
  _build_player_name({ external_player }) {
    if (external_player.player_name) {
      return external_player.player_name
    }

    // Never hand the fuzzy matcher a name assembled from absent parts -- an
    // unguarded join yields the literal "undefined undefined" and matches
    // whatever is closest to it.
    const name_parts = [
      external_player.first_name,
      external_player.last_name
    ].filter(Boolean)

    return name_parts.length > 0 ? name_parts.join(' ') : null
  }

  /**
   * Get the canonical `player_ids` key holding a platform's own player ID
   * @param {object} options - Lookup options
   * @param {string} options.platform - Platform identifier
   * @returns {string} Canonical player_ids key
   * @private
   */
  _get_platform_player_id_key({ platform }) {
    const player_id_key =
      PLATFORM_PLAYER_ID_KEYS[String(platform).toLowerCase()]

    if (!player_id_key) {
      throw new Error(
        `No canonical player id field defined for platform: ${platform}`
      )
    }

    return player_id_key
  }

  /**
   * Extract team ID from external roster (canonical format)
   * @param {object} options - Team ID extraction options
   * @param {object} options.external_roster - External roster data in canonical format
   * @returns {string} External team ID
   * @private
   */
  _extract_team_id({ external_roster }) {
    return external_roster.team_external_id
  }

  /**
   * Extract roster players from external roster (canonical format)
   * @param {object} options - Roster players extraction options
   * @param {object} options.external_roster - External roster data in canonical format
   * @param {string} options.platform - Platform identifier
   * @returns {object[]} Array of `{ external_player_id, slot }` entries
   * @private
   */
  _extract_roster_players({ external_roster, platform }) {
    const player_id_key = this._get_platform_player_id_key({ platform })

    return (external_roster.players || []).map((roster_player) => {
      const { roster_slot_category } = roster_player
      // A category outside the canonical vocabulary still benches the player,
      // because refusing the whole roster over a slot label would be worse. It
      // is logged rather than absorbed silently: ESPN emitted `STARTER` against
      // a schema declaring `STARTING` for as long as this fallback hid it, and
      // the same drift on `INJURED_RESERVE` would misfile an IR player onto the
      // active roster with nothing to show for it.
      if (
        roster_slot_category != null &&
        !(roster_slot_category in ROSTER_SLOT_BY_CATEGORY)
      ) {
        log(
          `unknown roster_slot_category '${roster_slot_category}' from ${platform}, benching -- see canonical-roster-format.json`
        )
      }

      return {
        external_player_id: roster_player.player_ids?.[player_id_key],
        slot:
          ROSTER_SLOT_BY_CATEGORY[roster_slot_category] ??
          roster_slot_types.BENCH
      }
    })
  }
}

export default RosterSync
