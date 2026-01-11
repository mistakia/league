import debug from 'debug'

import {
  get_play_type_ngs,
  get_play_type_nfl
} from '#libs-server/play-stats-utils.mjs'

const log = debug('play-enrichment:play-type')

/**
 * Enriches plays with normalized play_type from NGS or NFL sources
 *
 * Prioritizes play_type_ngs if available, falls back to play_type_nfl.
 * Converts source-specific play types to standardized play_type enum.
 *
 * @param {Array} plays - Array of play objects with play_type_ngs and/or play_type_nfl
 * @returns {Array} Plays with play_type field populated
 */
export const enrich_play_types = (plays) => {
  let enriched_count = 0
  let skipped_count = 0

  const enriched_plays = plays.map((play) => {
    let play_type = null

    const desc = play.desc || ''
    const desc_upper = desc.toUpperCase()
    const desc_lower = desc.toLowerCase()

    // Check if play was negated by penalty
    // Plays with "no play" in description should always be NOPL regardless of original type
    // This handles cases like extra points, field goals, passes, runs that were negated
    if (desc_lower.includes('no play')) {
      play_type = 'NOPL'
    }
    // Special case: TWO-POINT CONVERSION with "enforced between downs" penalty
    // NFL API returns play_type_nfl="PENALTY" for conversions with post-play penalties
    // These are valid conversions where the penalty didn't negate the play
    else if (
      desc_upper.includes('TWO-POINT CONVERSION ATTEMPT') &&
      desc_lower.includes('enforced between downs')
    ) {
      play_type = 'CONV'
    } else {
      // Prioritize NGS play type
      if (play.play_type_ngs) {
        play_type = get_play_type_ngs(play.play_type_ngs)
      }

      // Fall back to NFL play type
      if (!play_type && play.play_type_nfl) {
        play_type = get_play_type_nfl(play.play_type_nfl)
      }
    }

    // Skip plays without either type
    if (!play_type) {
      skipped_count++
      return play
    }

    enriched_count++

    return {
      ...play,
      play_type,
      // NOPL plays shouldn't be marked as special teams
      // (penalties during ST formations don't count as ST plays)
      ...(play_type === 'NOPL' && { special: false })
    }
  })

  log(
    `Play type enrichment: ${enriched_count} enriched, ${skipped_count} skipped`
  )

  return enriched_plays
}
