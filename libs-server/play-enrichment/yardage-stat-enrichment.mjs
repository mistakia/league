import debug from 'debug'

import getPlayFromPlayStats from '#libs-shared/get-play-from-play-stats.mjs'
import { group_play_stats_by_play } from './enrichment-helpers.mjs'

const log = debug('play-enrichment:yardage-stats')

/**
 * Enriches plays with yardage statistics from play_stats using GSIS statId mappings
 *
 * Extracts yardage data from NFL API playStats based on statId:
 * - statId 10/11: Rushing yards → rush_yds
 * - statId 15/16: Passing yards → pass_yds
 * - statId 21/22: Receiving yards → recv_yds
 * - Aggregates yds_gained from all yardage plays
 *
 * Also enriches completion status (comp), touchdowns (td, rush_td, pass_td),
 * and other play outcome fields from playStats.
 *
 * @param {Array} plays - Array of play objects with esbid and playId
 * @param {Array} play_stats - Array of play stat objects from NFL API
 * @returns {Array} Plays with yardage and outcome fields populated
 */
export const enrich_yardage_stats = (plays, play_stats) => {
  if (!play_stats || play_stats.length === 0) {
    log('No play_stats provided, skipping yardage enrichment')
    return plays
  }

  // Group play_stats by play for efficient lookup
  const play_stats_by_play = group_play_stats_by_play(play_stats)

  log(`Processing yardage stats for ${plays.length} plays`)

  let enriched_count = 0
  let skipped_count = 0

  const enriched_plays = plays.map((play) => {
    const play_key = `${play.esbid}-${play.playId}`
    const stats_for_play = play_stats_by_play.get(play_key)

    if (!stats_for_play || stats_for_play.length === 0) {
      skipped_count++
      return play
    }

    // Convert play_stats array to format expected by getPlayFromPlayStats
    // The function expects { playStats: [...] } structure
    const play_with_stats = {
      playStats: stats_for_play
    }

    // Extract all yardage and outcome data using statId mappings
    const stats_data = getPlayFromPlayStats(play_with_stats)

    // Explicitly include only the fields we need and that exist in the database schema
    const enrichment_data = {}

    // Yardage fields
    if (stats_data.rush_yds != null)
      enrichment_data.rush_yds = stats_data.rush_yds
    if (stats_data.pass_yds != null)
      enrichment_data.pass_yds = stats_data.pass_yds
    if (stats_data.recv_yds != null)
      enrichment_data.recv_yds = stats_data.recv_yds
    if (stats_data.yds_gained != null)
      enrichment_data.yds_gained = stats_data.yds_gained
    if (stats_data.ret_yds != null) enrichment_data.ret_yds = stats_data.ret_yds

    // Completion and outcome fields
    if (stats_data.comp != null) enrichment_data.comp = stats_data.comp
    if (stats_data.td != null) enrichment_data.td = stats_data.td
    if (stats_data.rush_td != null) enrichment_data.rush_td = stats_data.rush_td
    if (stats_data.pass_td != null) enrichment_data.pass_td = stats_data.pass_td
    if (stats_data.ret_td != null) enrichment_data.ret_td = stats_data.ret_td
    if (stats_data.int != null) enrichment_data.int = stats_data.int
    if (stats_data.sk != null) enrichment_data.sk = stats_data.sk
    if (stats_data.fuml != null) enrichment_data.fuml = stats_data.fuml
    if (stats_data.first_down != null)
      enrichment_data.first_down = stats_data.first_down

    // Air yards and yards after catch
    if (stats_data.dot != null) enrichment_data.dot = stats_data.dot
    if (stats_data.yards_after_catch != null)
      enrichment_data.yards_after_catch = stats_data.yards_after_catch

    // Player GSIS IDs
    if (stats_data.bc_gsis != null) enrichment_data.bc_gsis = stats_data.bc_gsis
    if (stats_data.psr_gsis != null)
      enrichment_data.psr_gsis = stats_data.psr_gsis
    if (stats_data.trg_gsis != null)
      enrichment_data.trg_gsis = stats_data.trg_gsis
    if (stats_data.intp_gsis != null)
      enrichment_data.intp_gsis = stats_data.intp_gsis
    if (stats_data.player_fuml_gsis != null)
      enrichment_data.player_fuml_gsis = stats_data.player_fuml_gsis

    // Scoring team
    if (stats_data.td_tm != null) enrichment_data.td_tm = stats_data.td_tm
    if (stats_data.ret_tm != null) enrichment_data.ret_tm = stats_data.ret_tm

    // Only count as enriched if we actually got yardage data
    if (
      enrichment_data.rush_yds !== undefined ||
      enrichment_data.pass_yds !== undefined ||
      enrichment_data.recv_yds !== undefined ||
      enrichment_data.yds_gained !== undefined
    ) {
      enriched_count++
    } else {
      skipped_count++
    }

    // Merge enrichment data into play, preserving existing fields
    return {
      ...play,
      ...enrichment_data
    }
  })

  log(
    `Yardage enrichment complete: ${enriched_count} enriched, ${skipped_count} skipped`
  )

  return enriched_plays
}
