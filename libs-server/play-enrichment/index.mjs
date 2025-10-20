import debug from 'debug'

import { enrich_team_assignments } from './team-assignment-enrichment.mjs'
import { enrich_play_types } from './play-type-enrichment.mjs'
import { enrich_play_success } from './success-metric-enrichment.mjs'
import { enrich_player_identifications } from './player-identification-enrichment.mjs'

const log = debug('play-enrichment')

/**
 * Main enrichment orchestrator that coordinates all play enrichment operations
 *
 * @param {Object} params - Enrichment parameters
 * @param {Array} params.plays - Array of play objects to enrich
 * @param {Array} params.play_stats - Array of play stat objects for player identification
 * @param {Map|Object} params.games_map - Map or object of game data keyed by esbid
 * @param {Object} params.player_cache - Player cache instance for GSIS ID lookups
 * @param {Object} params.options - Optional flags to control which enrichments to run
 * @param {boolean} params.options.teams - Enable team assignment enrichment (default: true)
 * @param {boolean} params.options.play_types - Enable play type enrichment (default: true)
 * @param {boolean} params.options.success - Enable success metric enrichment (default: true)
 * @param {boolean} params.options.players - Enable player identification enrichment (default: true)
 * @returns {Promise<Array>} Enriched play objects (does NOT persist to database)
 */
export const enrich_plays = async ({
  plays,
  play_stats = [],
  games_map = {},
  player_cache = null,
  options = {}
}) => {
  // Default options - enable all enrichments by default
  const {
    teams = true,
    play_types = true,
    success = true,
    players = true
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

    // Phase 3: Success metrics
    if (success) {
      try {
        enriched_plays = enrich_play_success(enriched_plays)
      } catch (error) {
        log(`Success metric enrichment failed: ${error.message}`)
      }
    }

    // Phase 4: Player identifications
    if (players && play_stats.length > 0 && player_cache) {
      try {
        enriched_plays = enrich_player_identifications(
          enriched_plays,
          play_stats,
          player_cache
        )
      } catch (error) {
        log(`Player identification enrichment failed: ${error.message}`)
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
