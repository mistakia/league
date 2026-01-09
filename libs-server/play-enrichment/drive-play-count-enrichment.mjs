import debug from 'debug'

const log = debug('drive-play-count-enrichment')

/**
 * Determines if a play should be counted in drive_play_count
 *
 * Counts scrimmage plays only, excluding:
 * - Administrative plays (GAME_START, END_QUARTER, END_GAME, timeouts)
 * - Kickoffs (these start drives but aren't offensive plays)
 * - Punts (drive-ending plays, excluded to match nflfastr methodology)
 * - Field goals and extra points (FGXP - special teams, not scrimmage plays)
 * - Two-point conversions (CONV - conversion attempts, not scrimmage plays)
 * - Plays marked as deleted
 * - Nullified plays (penalty with no play)
 *
 * Note: nflfastr's drive_play_count excludes punts, so a traditional
 * "three and out" (3 offensive plays followed by a punt) results in
 * drive_play_count = 3. This matches the DST scoring logic in
 * calculate-dst-stats-from-plays.mjs which checks drive_play_count === 3.
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

  // Exclude punts - drive-ending plays not counted in nflfastr's drive_play_count
  // This ensures a "three and out" (3 plays + punt) has drive_play_count = 3
  if (play.play_type === 'PUNT') {
    return false
  }

  // Exclude field goals and extra points - special teams plays, not scrimmage plays
  if (play.play_type === 'FGXP') {
    return false
  }

  // Exclude two-point conversions - conversion attempts, not scrimmage plays
  if (play.play_type === 'CONV') {
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
 * Plays with null/undefined drive_seq (administrative plays like TIMEOUT,
 * GAME_START, etc.) receive null for drive_play_count since they don't
 * belong to any meaningful drive.
 *
 * @param {Array} plays - Array of play objects to enrich
 * @returns {Array} Plays with drive_play_count added
 */
export const enrich_drive_play_counts = (plays) => {
  log(`Starting drive play count enrichment for ${plays.length} plays`)

  // Group plays by game and drive
  // Skip plays without drive_seq - they don't belong to any drive
  const drives_map = new Map()
  let skipped_null_drive = 0

  for (const play of plays) {
    // Plays without drive_seq are administrative plays (TIMEOUT, GAME_START, etc.)
    // They should not be grouped or counted - they'll receive null drive_play_count
    if (play.drive_seq === null || play.drive_seq === undefined) {
      skipped_null_drive++
      continue
    }

    const key = `${play.esbid}_${play.drive_seq}`

    if (!drives_map.has(key)) {
      drives_map.set(key, [])
    }

    drives_map.get(key).push(play)
  }

  log(
    `Found ${drives_map.size} unique drives (skipped ${skipped_null_drive} plays with null drive_seq)`
  )

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
    // Plays without drive_seq get null - they don't belong to any drive
    if (play.drive_seq === null || play.drive_seq === undefined) {
      return {
        ...play,
        drive_play_count: null
      }
    }

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
