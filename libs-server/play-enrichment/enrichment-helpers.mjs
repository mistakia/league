import debug from 'debug'

const log = debug('play-enrichment:helpers')

/**
 * Groups play_stats by play for efficient lookup
 *
 * @param {Array} play_stats - Array of play stat objects with esbid and playId
 * @returns {Map} Map keyed by "${esbid}-${playId}" with array of play_stats as values
 */
export const group_play_stats_by_play = (play_stats) => {
  const grouped = new Map()

  for (const stat of play_stats) {
    if (!stat.esbid || !stat.playId) {
      continue
    }

    const play_key = `${stat.esbid}-${stat.playId}`

    if (!grouped.has(play_key)) {
      grouped.set(play_key, [])
    }

    grouped.get(play_key).push(stat)
  }

  log(`Grouped ${play_stats.length} play_stats into ${grouped.size} plays`)

  return grouped
}
