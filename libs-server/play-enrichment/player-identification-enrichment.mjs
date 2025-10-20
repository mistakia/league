import debug from 'debug'

import getPlayFromPlayStats from '#libs-shared/get-play-from-play-stats.mjs'
import { group_play_stats_by_play } from './enrichment-helpers.mjs'

const log = debug('play-enrichment:player-identification')

/**
 * Enriches plays with player identifications by mapping GSIS IDs to internal PIDs
 *
 * Processes play_stats to extract GSIS IDs for all player roles:
 * - Ball carrier (bc_pid)
 * - Passer (psr_pid)
 * - Target receiver (trg_pid)
 * - Interceptor (intp_pid)
 * - Fumbler (player_fuml_pid)
 * - Solo tacklers (tacklers_solo arrays)
 * - Tacklers with assists (tacklers_with_assisters arrays)
 * - Tackle assisters (tackle_assisters arrays)
 *
 * @param {Array} plays - Array of play objects with esbid and playId
 * @param {Array} play_stats - Array of play stat objects with GSIS IDs
 * @param {Object} player_cache - Player cache instance with find_player method
 * @returns {Array} Plays with all player _pid fields populated
 */
export const enrich_player_identifications = (
  plays,
  play_stats,
  player_cache
) => {
  // Group play_stats by play for efficient lookup
  const play_stats_by_play = group_play_stats_by_play(play_stats)

  log(`Processing player identifications for ${plays.length} plays`)

  let enriched_count = 0
  let skipped_count = 0
  const missing_gsis_ids = new Set()

  // Helper function to map a single player role
  const map_player_field = (
    enriched_play,
    play_data,
    gsis_field,
    pid_field
  ) => {
    if (!play_data[gsis_field]) return false

    const player = player_cache.find_player({ gsisid: play_data[gsis_field] })
    if (player) {
      enriched_play[pid_field] = player.pid
      return true
    }

    missing_gsis_ids.add(play_data[gsis_field])
    return false
  }

  // Helper function to map tackle arrays
  const map_tackle_array = (
    enriched_play,
    gsis_array,
    field_prefix,
    max_count
  ) => {
    if (!gsis_array || gsis_array.length === 0) return false

    const pids = gsis_array
      .slice(0, max_count)
      .map((gsisid) => {
        const player = player_cache.find_player({ gsisid })
        if (!player) missing_gsis_ids.add(gsisid)
        return player?.pid || null
      })
      .filter((pid) => pid !== null)

    if (pids.length === 0) return false

    pids.forEach((pid, idx) => {
      enriched_play[`${field_prefix}_${idx + 1}_pid`] = pid
    })

    return true
  }

  const enriched_plays = plays.map((play) => {
    const play_key = `${play.esbid}-${play.playId}`
    const stats_for_play = play_stats_by_play.get(play_key)

    if (!stats_for_play || stats_for_play.length === 0) {
      skipped_count++
      return play
    }

    // Use getPlayFromPlayStats to extract GSIS IDs and play data
    const play_data = getPlayFromPlayStats({ playStats: stats_for_play })

    // Create enriched play object with all existing fields
    const enriched_play = { ...play }

    // Track if we enriched any player field
    let has_player_data = false

    // Single-player roles to map
    const single_player_roles = [
      { gsis: 'bc_gsis', pid: 'bc_pid' },
      { gsis: 'psr_gsis', pid: 'psr_pid' },
      { gsis: 'trg_gsis', pid: 'trg_pid' },
      { gsis: 'intp_gsis', pid: 'intp_pid' },
      { gsis: 'player_fuml_gsis', pid: 'player_fuml_pid' }
    ]

    // Map all single-player roles
    for (const role of single_player_roles) {
      if (map_player_field(enriched_play, play_data, role.gsis, role.pid)) {
        has_player_data = true
      }
    }

    // Map tackle arrays
    if (
      map_tackle_array(
        enriched_play,
        play_data.tacklers_solo,
        'solo_tackleer',
        3
      )
    ) {
      has_player_data = true
    }

    if (
      map_tackle_array(
        enriched_play,
        play_data.tacklers_with_assisters,
        'assist_tackle',
        2
      )
    ) {
      has_player_data = true
    }

    if (
      map_tackle_array(
        enriched_play,
        play_data.tackle_assisters,
        'tackle_with_assist',
        4
      )
    ) {
      has_player_data = true
    }

    if (has_player_data) {
      enriched_count++
    } else {
      skipped_count++
    }

    return enriched_play
  })

  log(
    `Player identification enrichment: ${enriched_count} enriched, ${skipped_count} skipped`
  )

  if (missing_gsis_ids.size > 0) {
    log(
      `Missing GSIS IDs (${missing_gsis_ids.size}): ${Array.from(missing_gsis_ids).slice(0, 10).join(', ')}${missing_gsis_ids.size > 10 ? '...' : ''}`
    )
  }

  return enriched_plays
}
