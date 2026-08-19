import debug from 'debug'

const log = debug('play-enrichment:helpers')

/**
 * Play types that mark a clock or administrative event rather than a snap.
 *
 * These are `play_type_nfl` values, not `play_type`: the latter collapses all
 * of them to `NOPL`, which real nullified penalty plays also carry.
 */
const ADMINISTRATIVE_PLAY_TYPES_NFL = [
  'GAME_START',
  'END_QUARTER',
  'END_GAME',
  'TIMEOUT',
  'COMMENT'
]

/**
 * Whether a play is a clock or administrative marker rather than football.
 *
 * These rows are not drives and do not belong to one -- a source that supplies
 * drive_sequence numbers them anyway, and NFL's feed stamps an end-of-quarter marker
 * with the sequence of the drive that is about to START. That makes the marker
 * a member of the previous half carrying the next half's drive number, which is
 * why the cross-half coherence auditor has to exclude them before it can tell a
 * real merged drive from a boundary artifact.
 *
 * A row whose type is administrative but which nonetheless records a pass or a
 * rush is a mislabeled real play (the feed carries a handful) and is kept.
 *
 * @param {object} play - Play object carrying play_type_nfl and play_type
 * @returns {boolean} True if the play is administrative
 */
export const is_administrative_play = (play) => {
  if (!ADMINISTRATIVE_PLAY_TYPES_NFL.includes(play.play_type_nfl)) {
    return false
  }

  if (play.is_passing_play || play.is_rushing_play) {
    return false
  }

  return play.play_type !== 'PASS' && play.play_type !== 'RUSH'
}

/**
 * Groups play_stats by play for efficient lookup
 *
 * @param {object[]} play_stats - Array of play stat objects with esbid and play_id
 * @returns {Map<string, object[]>} Map keyed by "${esbid}-${play_id}" with array of play_stats as values
 */
export const group_play_stats_by_play = (play_stats) => {
  const grouped = new Map()

  for (const stat of play_stats) {
    if (!stat.esbid || !stat.play_id) {
      continue
    }

    const play_key = `${stat.esbid}-${stat.play_id}`

    if (!grouped.has(play_key)) {
      grouped.set(play_key, [])
    }

    grouped.get(play_key).push(stat)
  }

  log(`Grouped ${play_stats.length} play_stats into ${grouped.size} plays`)

  return grouped
}
