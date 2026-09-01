import debug from 'debug'

import { enrich_team_assignments } from './team-assignment-enrichment.mjs'
import { enrich_play_types } from './play-type-enrichment.mjs'
import { enrich_qb_plays } from './qb-play-enrichment.mjs'
import { enrich_play_success } from './success-metric-enrichment.mjs'
import { enrich_player_identifications } from './player-identification-enrichment.mjs'
import { enrich_yardage_stats } from './yardage-stat-enrichment.mjs'
import { enrich_drive_play_counts } from './drive-play-count-enrichment.mjs'
import { enrich_fixed_drives } from './fixed-drive-enrichment.mjs'

const log = debug('play-enrichment')

/**
 * Main enrichment orchestrator that coordinates all play enrichment operations
 *
 * @param {object} params - Enrichment parameters
 * @param {object[]} params.plays - Array of play objects to enrich
 * @param {object[]} params.play_stats - Array of play stat objects for player identification
 * @param {Map<string, object>|object} params.games_map - Map or object of game data keyed by esbid
 * @param {object} params.player_cache - Player cache instance for GSIS ID lookups
 * @param {object} params.options - Optional flags to control which enrichments to run
 * @param {boolean} params.options.teams - Enable team assignment enrichment (default: true)
 * @param {boolean} params.options.play_types - Enable play type enrichment (default: true)
 * @param {boolean} params.options.success - Enable success metric enrichment (default: true)
 * @param {boolean} params.options.players - Enable player identification enrichment (default: true)
 * @param {boolean} params.options.fixed_drives - Enable fixed drive sequence enrichment (default: true)
 * @param {boolean} params.options.drive_counts - Enable drive play count enrichment (default: true)
 * @param {Map<number, Map<string, object[]>>} params.snap_roster_by_esbid - Week-accurate
 *   participation, built by `build_snap_roster_by_esbid`. REQUIRED whenever player
 *   identification will run; see the check below for why it has no default.
 * @returns {Promise<object[]>} Enriched play objects (does NOT persist to database)
 */
export const enrich_plays = async ({
  plays,
  play_stats = [],
  games_map = {},
  player_cache = null,
  snap_roster_by_esbid,
  options = {}
}) => {
  // Default options - enable all enrichments by default
  const {
    teams = true,
    play_types = true,
    qb_plays = true,
    success = true,
    players = true,
    fixed_drives = true,
    drive_counts = true
  } = options

  // Validate inputs
  if (!plays || !Array.isArray(plays)) {
    log('Invalid plays input - must be an array')
    return []
  }

  if (plays.length === 0) {
    log('No plays to enrich')
    return []
  }

  // The snap roster is REQUIRED, not optional, and this throw is the whole point.
  //
  // It was an optional parameter defaulting to null for most of its life, which
  // made omitting it a silent opt-out of the source-NULL-gsisId fallback rather
  // than a decision. That produced the same defect three separate times --
  // backfill-role-pids in 2026-08, then the importer and the private ngs writer,
  // each caught only by measuring row churn in production. Without the roster the
  // owned writer NULL-clears a role instead of recovering the actor, the next
  // finalization writes it straight back, and nothing logs either half.
  //
  // Gated on the identification phase actually running, because that is the only
  // phase that reads it. An EMPTY Map is legitimate -- a game with no snap data
  // has nothing to recover from -- so this checks for a supplied Map, not a
  // populated one. There is deliberately no opt-out flag: every production caller
  // knows its esbids and can call build_snap_roster_by_esbid.
  //
  // This throws BEFORE the try blocks below on purpose. Each phase swallows its
  // own errors and continues, which is exactly how a missing roster would go
  // silent again.
  const will_identify_players = players && play_stats.length > 0 && player_cache
  if (will_identify_players && !(snap_roster_by_esbid instanceof Map)) {
    throw new TypeError(
      'enrich_plays requires snap_roster_by_esbid (a Map from build_snap_roster_by_esbid) when player identification runs; omitting it silently NULL-clears recoverable roles'
    )
  }

  log(`Starting enrichment for ${plays.length} plays`)

  let enriched_plays = [...plays] // Create a copy to avoid mutating input

  try {
    // Phase 1: Team assignments
    if (teams && games_map) {
      try {
        enriched_plays = enrich_team_assignments(enriched_plays, games_map)
      } catch (error) {
        log(`Team assignment enrichment failed: ${error.message}`)
      }
    }

    // Phase 2: Play type normalization
    if (play_types) {
      try {
        enriched_plays = enrich_play_types(enriched_plays)
      } catch (error) {
        log(`Play type enrichment failed: ${error.message}`)
      }
    }

    // Phase 3: QB play detection (kneels, spikes)
    if (qb_plays) {
      try {
        enriched_plays = enrich_qb_plays(enriched_plays)
      } catch (error) {
        log(`QB play enrichment failed: ${error.message}`)
      }
    }

    // Phase 4: Yardage statistics from play_stats (always enabled)
    //
    // This MUST run before the success metric below, which reads yards_gained.
    // The two were once ordered the other way, and the bug that produced was
    // not a wrong value but a DISAGREEMENT between callers: this importer
    // enriches feed-shaped plays that carry no yards_gained of their own, so
    // success resolved to null on every play, while process-plays.mjs enriches
    // rows read back from nfl_plays where yards_gained is already stored and
    // resolved it to true/false. The importer then wrote its null over the
    // stored value on every pass and process_plays wrote the value back,
    // bumping nfl_plays.updated each time and defeating the finalization
    // watermark guard permanently. Both callers must derive the same value
    // from the same inputs; ordering is what makes that true here.
    if (play_stats.length > 0) {
      try {
        enriched_plays = enrich_yardage_stats(enriched_plays, play_stats)
      } catch (error) {
        log(`Yardage stat enrichment failed: ${error.message}`)
      }
    }

    // Phase 5: Success metrics -- depends on yards_gained from Phase 4
    if (success) {
      try {
        enriched_plays = enrich_play_success(enriched_plays)
      } catch (error) {
        log(`Success metric enrichment failed: ${error.message}`)
      }
    }

    // Phase 6: Player identifications
    // Same condition as the snap-roster requirement above, and deliberately the
    // same expression: if these two ever drift apart, the phase runs without the
    // roster the guard was supposed to have demanded.
    if (will_identify_players) {
      try {
        enriched_plays = enrich_player_identifications(
          enriched_plays,
          play_stats,
          player_cache,
          snap_roster_by_esbid
        )
      } catch (error) {
        log(`Player identification enrichment failed: ${error.message}`)
      }
    }

    // Phase 7: Fixed drive sequences
    // Calculates drive sequence numbers matching nflfastr's fixed_drive methodology
    // Must run BEFORE drive_play_counts since that depends on drive_sequence
    if (fixed_drives) {
      try {
        enriched_plays = enrich_fixed_drives(enriched_plays)
      } catch (error) {
        log(`Fixed drive enrichment failed: ${error.message}`)
      }
    }

    // Phase 8: Drive play counts
    // This must run AFTER play type enrichment since it depends on play_type field
    if (drive_counts) {
      try {
        enriched_plays = enrich_drive_play_counts(enriched_plays)
      } catch (error) {
        log(`Drive play count enrichment failed: ${error.message}`)
      }
    }

    log('Enrichment complete')
    return enriched_plays
  } catch (error) {
    log(`Fatal error during enrichment: ${error.message}`)
    // Return original plays on fatal error to avoid data loss
    return plays
  }
}
