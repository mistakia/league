import debug from 'debug'

const log = debug('play-enrichment:qb-play')

/**
 * Enriches plays with QB-specific flags based on play description analysis
 *
 * Detects QB kneels and spikes by parsing play descriptions from NFL v1 API.
 * These flags are used for fantasy scoring (exclude_qb_kneels option) and analytics.
 *
 * Detection patterns:
 * - qb_kneel: RUSH plays with "kneel" in description
 * - qb_spike: PASS plays with "spike" in description
 *
 * @param {Array} plays - Array of play objects with desc and play_type_nfl fields
 * @returns {Array} Plays with qb_kneel and qb_spike fields populated
 */
export const enrich_qb_plays = (plays) => {
  let qb_kneel_count = 0
  let qb_spike_count = 0

  const enriched_plays = plays.map((play) => {
    const desc = play.desc || ''
    const desc_lower = desc.toLowerCase()
    const play_type_nfl = (play.play_type_nfl || '').toUpperCase()

    const enriched = { ...play }

    // Detect QB kneel: RUSH play with "kneel" in description
    // Examples:
    //   "(:22) B.Purdy kneels to SEA 36 for -1 yards."
    //   "(:22) A.Brooks to BUF 35 for -1 yards. QB kneels"
    if (play_type_nfl === 'RUSH' && desc_lower.includes('kneel')) {
      enriched.qb_kneel = true
      qb_kneel_count++
    }

    // Detect QB spike: PASS play with "spike" in description
    // Example:
    //   "(:08) J.Allen spiked the ball to stop the clock."
    if (play_type_nfl === 'PASS' && desc_lower.includes('spike')) {
      enriched.qb_spike = true
      qb_spike_count++
    }

    return enriched
  })

  log(
    `QB play enrichment: ${qb_kneel_count} kneels, ${qb_spike_count} spikes detected`
  )

  return enriched_plays
}
