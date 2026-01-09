import debug from 'debug'

const log = debug('fixed-drive-enrichment')

/**
 * Fixed Drive Enrichment
 *
 * Calculates drive sequence numbers matching nflfastr's `fixed_drive` methodology.
 * This addresses edge cases where the NFL's official driveSequenceNumber is inconsistent.
 *
 * IMPORTANT: nflfastr's fixed_drive is the analytical standard and should be
 * considered authoritative when available. This enrichment serves as a fallback for:
 * - Live games before nflfastr data is available
 * - Games imported from non-nflfastr sources (NFL V1, Sportradar)
 *
 * Key differences from NFL's driveSequenceNumber:
 * - Kickoff fumble recoveries: Correctly treated as new drives
 * - PATs after defensive TDs: NOT counted as new drives
 * - Safeties: Kickoff after safety IS a new drive
 * - Lost fumbles: Same team regaining possession IS a new drive (unless TD occurred)
 *
 * Based on nflfastR's helper_add_fixed_drives.R by Sebastian Carl and Ben Baldwin.
 *
 * @see https://github.com/nflverse/nflfastR/blob/main/R/helper_add_fixed_drives.R
 */

/**
 * Determines if a play should start a new drive
 *
 * @param {Object} play - Current play object
 * @param {Object|null} prev_play - Previous play object (null for first play)
 * @param {Object|null} prev_play_2 - Play 2 positions back (for timeout edge cases)
 * @param {Object|null} prev_play_3 - Play 3 positions back (for double timeout edge cases)
 * @returns {boolean} True if this play starts a new drive
 */
const is_new_drive = (play, prev_play, prev_play_2, prev_play_3) => {
  // First play of a half is always a new drive
  if (!prev_play) {
    return true
  }

  const current_posteam = get_effective_posteam(play)
  const prev_posteam = prev_play ? get_effective_posteam(prev_play) : null
  const prev_posteam_2 = prev_play_2 ? get_effective_posteam(prev_play_2) : null
  const prev_posteam_3 = prev_play_3 ? get_effective_posteam(prev_play_3) : null

  // Check for PAT after defensive TD - NOT a new drive
  if (is_pat_after_defensive_td(play, prev_play, prev_play_2, prev_play_3)) {
    return false
  }

  // Check for kickoff recovery (onside kick or fumble) - IS a new drive
  if (is_kickoff_recovery(play)) {
    return true
  }

  // Check for kickoff after safety - IS a new drive
  if (is_kickoff_after_safety(play, prev_play, prev_play_2)) {
    return true
  }

  // Check for same team regaining possession after lost fumble - IS a new drive
  // (unless the play resulted in a touchdown)
  if (is_fumble_recovery_same_team(play, prev_play, prev_play_2)) {
    return true
  }

  // Standard case: change in possession team
  if (current_posteam && prev_posteam && current_posteam !== prev_posteam) {
    return true
  }

  // Handle NA posteam in previous play(s)
  if (current_posteam && !prev_posteam && prev_posteam_2) {
    if (current_posteam !== prev_posteam_2) {
      return true
    }
  }

  if (current_posteam && !prev_posteam && !prev_posteam_2 && prev_posteam_3) {
    if (current_posteam !== prev_posteam_3) {
      return true
    }
  }

  return false
}

/**
 * Gets the effective possession team for drive calculation.
 * On kickoffs that are recovered/fumbled, the kicking team should be treated
 * as the posteam for drive calculation purposes (swap from defteam).
 *
 * @param {Object} play - Play object
 * @returns {string|null} Effective possession team
 */
const get_effective_posteam = (play) => {
  // On kickoffs where the kicking team recovers (onside kick or fumble),
  // swap the possession team for drive calculation
  if (
    play.play_type === 'KOFF' &&
    (play.own_kickoff_recovery || play.fumble_lost)
  ) {
    return play.def // Kicking team is listed as def on kickoffs
  }

  return play.off || play.pos_team
}

/**
 * Checks if play is a PAT following a defensive touchdown.
 * PATs after defensive TDs should NOT be counted as new drives.
 */
const is_pat_after_defensive_td = (
  play,
  prev_play,
  prev_play_2,
  prev_play_3
) => {
  // Check if previous play was a defensive TD
  if (prev_play && prev_play.touchdown && prev_play.off !== prev_play.td_team) {
    return true
  }

  // Check if TD was 2 plays ago with timeout in between
  if (
    prev_play &&
    is_timeout_or_warning(prev_play) &&
    prev_play_2 &&
    prev_play_2.touchdown &&
    prev_play_2.off !== prev_play_2.td_team
  ) {
    return true
  }

  // Check if TD was 3 plays ago with 2 timeouts in between
  if (
    prev_play &&
    is_timeout_or_warning(prev_play) &&
    prev_play_2 &&
    is_timeout_or_warning(prev_play_2) &&
    prev_play_3 &&
    prev_play_3.touchdown &&
    prev_play_3.off !== prev_play_3.td_team
  ) {
    return true
  }

  return false
}

/**
 * Checks if play is a kickoff that was recovered by the kicking team
 */
const is_kickoff_recovery = (play) => {
  return (
    play.play_type === 'KOFF' && (play.own_kickoff_recovery || play.fumble_lost)
  )
}

/**
 * Checks if play is a kickoff following a safety
 */
const is_kickoff_after_safety = (play, prev_play, prev_play_2) => {
  if (play.play_type !== 'KOFF' && !play.kickoff_att) {
    return false
  }

  // Safety on previous play
  if (prev_play && prev_play.safety) {
    return true
  }

  // Safety 2 plays ago with timeout/no-play in between
  if (
    prev_play_2 &&
    prev_play_2.safety &&
    prev_play &&
    (!prev_play.play_type || prev_play.play_type === 'NOPL')
  ) {
    return true
  }

  return false
}

/**
 * Checks if same team regained possession after a lost fumble (new drive)
 */
const is_fumble_recovery_same_team = (play, prev_play, prev_play_2) => {
  const current_posteam = get_effective_posteam(play)

  // Same team has ball after lost fumble on punt, pass, or rush
  if (
    prev_play &&
    current_posteam &&
    current_posteam === get_effective_posteam(prev_play) &&
    prev_play.fumble_lost &&
    ['PUNT', 'PASS', 'RUSH'].includes(prev_play.play_type) &&
    !prev_play.touchdown // Not if it was a TD
  ) {
    return true
  }

  // Same check but with NA posteam in between
  const prev_posteam_2 = prev_play_2 ? get_effective_posteam(prev_play_2) : null
  if (
    prev_play_2 &&
    !get_effective_posteam(prev_play) &&
    current_posteam &&
    current_posteam === prev_posteam_2 &&
    prev_play_2.fumble_lost &&
    ['PUNT', 'PASS', 'RUSH'].includes(prev_play_2.play_type) &&
    !prev_play_2.touchdown
  ) {
    return true
  }

  return false
}

/**
 * Checks if a play is a timeout or two-minute warning
 */
const is_timeout_or_warning = (play) => {
  if (!play.desc) return false
  return /Timeout|Two-Minute Warning/i.test(play.desc)
}

/**
 * Calculates fixed_drive for all plays in a game
 *
 * @param {Array} plays - Array of play objects for a single game, sorted by playId
 * @returns {Array} Plays with fixed_drive added
 */
export const enrich_fixed_drives = (plays) => {
  log(`Starting fixed drive enrichment for ${plays.length} plays`)

  if (plays.length === 0) {
    return plays
  }

  // Group plays by game and half
  const games_map = new Map()

  for (const play of plays) {
    const game_half_key = `${play.esbid}_${play.qtr <= 2 ? 1 : 2}`

    if (!games_map.has(game_half_key)) {
      games_map.set(game_half_key, [])
    }
    games_map.get(game_half_key).push(play)
  }

  // Process each game-half
  const enriched_plays = []
  let total_drives = 0

  for (const [game_half_key, half_plays] of games_map.entries()) {
    // Sort by playId to ensure correct order
    half_plays.sort((a, b) => a.playId - b.playId)

    let drive_number = 0

    for (let i = 0; i < half_plays.length; i++) {
      const play = half_plays[i]
      const prev_play = i > 0 ? half_plays[i - 1] : null
      const prev_play_2 = i > 1 ? half_plays[i - 2] : null
      const prev_play_3 = i > 2 ? half_plays[i - 3] : null

      if (is_new_drive(play, prev_play, prev_play_2, prev_play_3)) {
        drive_number++
      }

      // Build enriched play with fixed_drive
      // Also populate drive_seq if not already present (for Sportradar/NFL V1 sources)
      // This is needed because enrich_drive_play_counts depends on drive_seq
      const enriched_play = {
        ...play,
        fixed_drive: drive_number
      }

      // Only set drive_seq if not already populated from source data
      // nflfastr and other sources may have their own drive_seq values
      if (play.drive_seq === null || play.drive_seq === undefined) {
        enriched_play.drive_seq = drive_number
      }

      enriched_plays.push(enriched_play)
    }

    total_drives = Math.max(total_drives, drive_number)
    log(`${game_half_key}: ${drive_number} drives`)
  }

  log(`Fixed drive enrichment complete. Total max drives: ${total_drives}`)
  return enriched_plays
}
