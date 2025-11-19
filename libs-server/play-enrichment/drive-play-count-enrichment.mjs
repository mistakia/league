import debug from 'debug'

const log = debug('drive-play-count-enrichment')

/**
 * Determines if a play should be counted in drive_play_count
 *
 * Counts scrimmage plays only, excluding:
 * - Administrative plays (GAME_START, END_QUARTER, END_GAME, timeouts)
 * - Kickoffs (these start drives but aren't offensive plays)
 * - Plays marked as deleted
 * - Nullified plays (penalty with no play)
 *
 * @param {Object} play - Play object to evaluate
 * @returns {boolean} True if play should be counted
 */
const should_count_play = (play) => {
  // Exclude deleted plays
  if (play.deleted) {
    return false
  }

  // Exclude administrative play types
  const excluded_types = ['GAME_START', 'END_QUARTER', 'END_GAME', 'TIMEOUT']
  if (excluded_types.includes(play.play_type_nfl)) {
    return false
  }

  // Exclude kickoffs - they start drives but aren't offensive plays
  if (play.play_type === 'KOFF') {
    return false
  }

  // Exclude no-play events that are pure penalties (no actual play occurred)
  // A play with play_type='NOPL' but with pass/rush/etc is still counted
  if (play.play_type === 'NOPL' && !play.pass && !play.rush) {
    return false
  }

  return true
}

/**
 * Calculates drive_play_count for all plays
 *
 * This enrichment counts the number of scrimmage plays in each drive,
 * matching nflfastr's drive_play_count methodology.
 *
 * For incomplete drives (live games), only counts plays that have occurred so far.
 *
 * @param {Array} plays - Array of play objects to enrich
 * @returns {Array} Plays with drive_play_count added
 */
export const enrich_drive_play_counts = (plays) => {
  log(`Starting drive play count enrichment for ${plays.length} plays`)

  // Group plays by game and drive
  const drives_map = new Map()

  for (const play of plays) {
    const key = `${play.esbid}_${play.drive_seq}`

    if (!drives_map.has(key)) {
      drives_map.set(key, [])
    }

    drives_map.get(key).push(play)
  }

  log(`Found ${drives_map.size} unique drives`)

  // Calculate play counts for each drive
  const drive_counts = new Map()

  for (const [drive_key, drive_plays] of drives_map.entries()) {
    // Count only scrimmage plays
    const count = drive_plays.filter(should_count_play).length
    drive_counts.set(drive_key, count)

    const [esbid, drive_seq] = drive_key.split('_')
    log(
      `Drive ${esbid}/${drive_seq}: ${count} countable plays out of ${drive_plays.length} total`
    )
  }

  // Enrich all plays with their drive's play count
  const enriched_plays = plays.map((play) => {
    const key = `${play.esbid}_${play.drive_seq}`
    const count = drive_counts.get(key)

    return {
      ...play,
      drive_play_count: count !== undefined ? count : null
    }
  })

  log('Drive play count enrichment complete')
  return enriched_plays
}
