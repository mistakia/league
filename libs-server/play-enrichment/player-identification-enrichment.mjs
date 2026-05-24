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

  // Helper function to map a single player role.
  // Prefers play_stats-derived gsis but falls back to the existing nfl_plays
  // column when play_stats lacks a row carrying that gsisid (e.g. NOPL penalty
  // plays where the play_stat row is the penalty actor, PAT2 plays whose psr
  // is not surfaced by play_stats, or sportradar-imported plays).
  // See user:text/league/data-quality-and-validation.md.
  const map_player_field = (
    enriched_play,
    play_data,
    gsis_field,
    pid_field
  ) => {
    const gsis = play_data[gsis_field] || enriched_play[gsis_field]
    if (!gsis) return false
    if (enriched_play[pid_field]) return true

    // Include all players regardless of current status for historical play attribution
    const player = player_cache.find_player({
      gsisid: gsis,
      ignore_free_agent: false,
      ignore_retired: false
    })
    if (player) {
      enriched_play[pid_field] = player.pid
      return true
    }

    missing_gsis_ids.add(gsis)
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
        // Include all players regardless of current status for historical play attribution
        const player = player_cache.find_player({
          gsisid,
          ignore_free_agent: false,
          ignore_retired: false
        })
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

  // Resolve tackle slot _pid columns from existing _gsis columns on the play
  // row. Used when play_stats does not carry a valid statId 79/80/82 row for
  // this slot but the play row still has a gsis value from an earlier import.
  const map_tackle_array_from_play_row = (
    enriched_play,
    field_prefix,
    max_count
  ) => {
    let any = false
    for (let i = 1; i <= max_count; i++) {
      const gsis_field = `${field_prefix}_${i}_gsis`
      const pid_field = `${field_prefix}_${i}_pid`
      const gsis = enriched_play[gsis_field]
      if (!gsis || enriched_play[pid_field]) continue
      const player = player_cache.find_player({
        gsisid: gsis,
        ignore_free_agent: false,
        ignore_retired: false
      })
      if (player) {
        enriched_play[pid_field] = player.pid
        any = true
      } else {
        missing_gsis_ids.add(gsis)
      }
    }
    return any
  }

  // Single-player roles to map
  const single_player_roles = [
    { gsis: 'bc_gsis', pid: 'bc_pid' },
    { gsis: 'psr_gsis', pid: 'psr_pid' },
    { gsis: 'trg_gsis', pid: 'trg_pid' },
    { gsis: 'intp_gsis', pid: 'intp_pid' },
    { gsis: 'player_fuml_gsis', pid: 'player_fuml_pid' },
    { gsis: 'penalty_player_gsis', pid: 'penalty_player_pid' }
  ]

  const enriched_plays = plays.map((play) => {
    const play_key = `${play.esbid}-${play.playId}`
    const stats_for_play = play_stats_by_play.get(play_key)
    const has_stats = Boolean(stats_for_play && stats_for_play.length > 0)

    // play_data carries play_stats-derived gsis values; empty when no
    // play_stats exist for the play. Single-player role mapping still runs
    // via play-row fallback in map_player_field.
    const play_data = has_stats
      ? getPlayFromPlayStats({ playStats: stats_for_play })
      : {}

    // Create enriched play object with all existing fields
    const enriched_play = { ...play }

    // Track if we enriched any player field
    let has_player_data = false

    // Map all single-player roles
    for (const role of single_player_roles) {
      if (map_player_field(enriched_play, play_data, role.gsis, role.pid)) {
        has_player_data = true
      }
    }

    // Map tackle arrays. play_data carries the play_stats-derived gsis arrays
    // (statId 79 -> tacklers_solo, statId 80 -> tacklers_with_assisters,
    // statId 82 -> tackle_assisters); play-row fallback fills _pid from
    // existing solo_tackle_N_gsis / assisted_tackle_N_gsis / tackle_assist_N_gsis
    // columns when play_stats is silent (no row, or upstream marked statId 79
    // valid=false after a solo->assist reclassification). Without the fallback,
    // ~63 plays/year of 2024 REG show solo_tackle_1_gsis IS NOT NULL with
    // solo_tackle_1_pid IS NULL. Caveat: when upstream reclassifies a tackle
    // entirely to a different player (X solo -> Y solo), this fallback leaves
    // the stale gsis on the play row -- proper redesign (enrichment fully
    // owns role-attribution + clears on play_stats churn) is tracked under
    // [tackle_fix_design_a] in user:text/league/data-quality-and-validation.md.
    if (
      map_tackle_array(
        enriched_play,
        play_data.tacklers_solo,
        'solo_tackle',
        3
      ) ||
      map_tackle_array_from_play_row(enriched_play, 'solo_tackle', 3)
    ) {
      has_player_data = true
    }

    if (
      map_tackle_array(
        enriched_play,
        play_data.tacklers_with_assisters,
        'assisted_tackle',
        2
      ) ||
      map_tackle_array_from_play_row(enriched_play, 'assisted_tackle', 2)
    ) {
      has_player_data = true
    }

    if (
      map_tackle_array(
        enriched_play,
        play_data.tackle_assisters,
        'tackle_assist',
        4
      ) ||
      map_tackle_array_from_play_row(enriched_play, 'tackle_assist', 4)
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
