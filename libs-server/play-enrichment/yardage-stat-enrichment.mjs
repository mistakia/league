import debug from 'debug'

import getPlayFromPlayStats from '#libs-shared/get-play-from-play-stats.mjs'
import { group_play_stats_by_play } from './enrichment-helpers.mjs'

const log = debug('play-enrichment:yardage-stats')

/**
 * Enriches plays with yardage statistics from play_stats using GSIS statId mappings
 *
 * Extracts yardage data from NFL API playStats based on statId:
 * - statId 10/11: Rushing yards → rush_yards
 * - statId 15/16: Passing yards → pass_yards
 * - statId 21/22: Receiving yards → receiving_yards
 * - Aggregates yards_gained from all yardage plays
 *
 * Also enriches completion status (comp), touchdowns (td, rush_td, pass_td),
 * and other play outcome fields from playStats.
 *
 * @param {Array} plays - Array of play objects with esbid and play_id
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
    const play_key = `${play.esbid}-${play.play_id}`
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
    if (stats_data.rush_yards != null)
      enrichment_data.rush_yards = stats_data.rush_yards
    if (stats_data.pass_yards != null)
      enrichment_data.pass_yards = stats_data.pass_yards
    if (stats_data.receiving_yards != null)
      enrichment_data.receiving_yards = stats_data.receiving_yards
    if (stats_data.yards_gained != null)
      enrichment_data.yards_gained = stats_data.yards_gained
    if (stats_data.return_yards != null)
      enrichment_data.return_yards = stats_data.return_yards

    // Completion and outcome fields
    if (stats_data.is_completion != null)
      enrichment_data.is_completion = stats_data.is_completion
    if (stats_data.is_touchdown != null)
      enrichment_data.is_touchdown = stats_data.is_touchdown
    if (stats_data.is_rushing_touchdown != null)
      enrichment_data.is_rushing_touchdown = stats_data.is_rushing_touchdown
    if (stats_data.is_passing_touchdown != null)
      enrichment_data.is_passing_touchdown = stats_data.is_passing_touchdown
    if (stats_data.is_return_touchdown != null)
      enrichment_data.is_return_touchdown = stats_data.is_return_touchdown
    if (stats_data.is_interception != null)
      enrichment_data.is_interception = stats_data.is_interception
    if (stats_data.is_sack != null) enrichment_data.is_sack = stats_data.is_sack
    if (stats_data.is_fumble_lost != null)
      enrichment_data.is_fumble_lost = stats_data.is_fumble_lost
    if (stats_data.is_first_down != null)
      enrichment_data.is_first_down = stats_data.is_first_down

    // Air yards and yards after catch
    if (stats_data.dot != null) enrichment_data.depth_of_target = stats_data.dot
    if (stats_data.yards_after_catch != null)
      enrichment_data.yards_after_catch = stats_data.yards_after_catch

    // _gsis writes moved to player-identification-enrichment so that {_gsis,
    // _pid} pairs write/clear in lockstep under the owned-family model. See
    // task/league/redesign-role-attribution-ownership.md Phase B.

    // Scoring team
    if (stats_data.touchdown_nfl_team != null)
      enrichment_data.touchdown_nfl_team = stats_data.touchdown_nfl_team
    if (stats_data.return_nfl_team != null)
      enrichment_data.return_nfl_team = stats_data.return_nfl_team

    // Only count as enriched if we actually got yardage data
    if (
      enrichment_data.rush_yards !== undefined ||
      enrichment_data.pass_yards !== undefined ||
      enrichment_data.receiving_yards !== undefined ||
      enrichment_data.yards_gained !== undefined
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
