import debug from 'debug'

import { is_successful_play } from '#libs-server/play-stats-utils.mjs'

const log = debug('play-enrichment:success-metric')

/**
 * Enriches plays with successful_play metric
 *
 * Calculates whether a play was "successful" based on down, distance, and yards gained.
 * Success criteria:
 * - 1st down: gain 40% of yards to go
 * - 2nd down: gain 60% of yards to go
 * - 3rd/4th down: gain 100% of yards to go (convert)
 *
 * @param {Array} plays - Array of play objects with yds_gained, yards_to_go, and dwn
 * @returns {Array} Plays with successful_play field populated
 */
export const enrich_play_success = (plays) => {
  let enriched_count = 0
  let skipped_count = 0

  const enriched_plays = plays.map((play) => {
    const successful_play = is_successful_play({
      yds_gained: play.yds_gained,
      yards_to_go: play.yards_to_go,
      dwn: play.dwn
    })

    // successful_play can be true, false, or null (if missing required data)
    if (successful_play !== null) {
      enriched_count++
    } else {
      skipped_count++
    }

    return {
      ...play,
      successful_play
    }
  })

  log(
    `Success metric enrichment: ${enriched_count} enriched, ${skipped_count} skipped`
  )

  return enriched_plays
}
