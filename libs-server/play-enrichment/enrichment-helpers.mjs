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
 * Sort key placing a play's stats in a total order both callers agree on.
 *
 * Downstream, map_owned_tackle_array assigns tackle_assist_1..4 (and the solo
 * and assisted tackle families) POSITIONALLY from the array built here, so the
 * array's order decides which player lands in which numbered column. That makes
 * the order part of the data, not an implementation detail.
 *
 * The two callers arrive with different orders and neither is canonical.
 * process-plays.mjs reads stats via get_play_stats, a query with no ORDER BY,
 * so Postgres returns them in whatever physical order the heap happens to hold
 * -- which itself moves as the importer rewrites those rows. import-plays-nfl-v1.mjs
 * builds them from the NFL feed's own playStats array. Left alone the two
 * disagree, the slots permute, and every pass reports a change: play_changelog
 * recorded the same two pids swapping tackle_assist_1_pid and tackle_assist_2_pid
 * back and forth eight times in eight hours on a single play.
 *
 * Note that determinism alone would NOT fix this. Sorting only inside
 * get_play_stats would make process_plays stable and still disagree with the
 * feed order forever. The sort has to live HERE, on the shared path both
 * callers reach through enrich_plays, so agreement holds by construction
 * rather than by two call sites remembering to match each other.
 *
 * @param {object} stat - Play stat object
 * @returns {(string|number)[]} Comparable tuple
 */
const play_stat_sort_key = (stat) => [
  Number(stat.stat_id) || 0,
  stat.player_name || '',
  stat.gsis_player_id || ''
]

/**
 * Groups play_stats by play for efficient lookup, in a caller-independent order
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

  for (const stats of grouped.values()) {
    stats.sort((a, b) => {
      const key_a = play_stat_sort_key(a)
      const key_b = play_stat_sort_key(b)

      for (let i = 0; i < key_a.length; i++) {
        if (key_a[i] < key_b[i]) return -1
        if (key_a[i] > key_b[i]) return 1
      }

      return 0
    })
  }

  log(`Grouped ${play_stats.length} play_stats into ${grouped.size} plays`)

  return grouped
}
