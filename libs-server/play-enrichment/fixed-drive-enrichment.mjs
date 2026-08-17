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
  // On kickoffs where the kicking team recovers the ball, swap the possession
  // team for drive calculation.
  //
  // nflfastR keys this off own_kickoff_recovery | fumble_lost. We have no
  // own_kickoff_recovery equivalent on nfl_plays, so a lost fumble on the
  // kickoff is the only signal available.
  if (play.play_type === 'KOFF' && play.is_fumble_lost) {
    return play.defense_nfl_team // Kicking team is listed as def on kickoffs
  }

  return play.offense_nfl_team || play.possession_nfl_team
}

/**
 * Checks whether a touchdown was scored by the defense.
 *
 * Requires touchdown_nfl_team to be populated -- an unattributed touchdown is treated as
 * not-defensive rather than defensive, so that plays with a missing scoring
 * team fall through to the ordinary possession-change rule instead of
 * suppressing every drive boundary that follows a touchdown.
 */
const is_defensive_td = (play) =>
  Boolean(
    play.is_touchdown &&
      play.touchdown_nfl_team &&
      play.offense_nfl_team !== play.touchdown_nfl_team
  )

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
  if (prev_play && is_defensive_td(prev_play)) {
    return true
  }

  // Check if TD was 2 plays ago with timeout in between
  if (
    prev_play &&
    is_timeout_or_warning(prev_play) &&
    prev_play_2 &&
    is_defensive_td(prev_play_2)
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
    is_defensive_td(prev_play_3)
  ) {
    return true
  }

  return false
}

/**
 * Checks if play is a kickoff that was recovered by the kicking team
 */
const is_kickoff_recovery = (play) => {
  return play.play_type === 'KOFF' && Boolean(play.is_fumble_lost)
}

/**
 * Checks if play is a kickoff following a safety
 */
const is_kickoff_after_safety = (play, prev_play, prev_play_2) => {
  if (play.play_type !== 'KOFF' && !play.is_kickoff_attempt) {
    return false
  }

  // Safety on previous play
  if (prev_play && prev_play.is_safety) {
    return true
  }

  // Safety 2 plays ago with timeout/no-play in between
  if (
    prev_play_2 &&
    prev_play_2.is_safety &&
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
    prev_play.is_fumble_lost &&
    ['PUNT', 'PASS', 'RUSH'].includes(prev_play.play_type) &&
    !prev_play.is_touchdown // Not if it was a TD
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
    prev_play_2.is_fumble_lost &&
    ['PUNT', 'PASS', 'RUSH'].includes(prev_play_2.play_type) &&
    !prev_play_2.is_touchdown
  ) {
    return true
  }

  return false
}

/**
 * Checks if a play is a timeout or two-minute warning
 */
const is_timeout_or_warning = (play) => {
  if (!play.play_description) return false
  return /Timeout|Two-Minute Warning/i.test(play.play_description)
}

/**
 * The half a play belongs to for drive-boundary purposes.
 *
 * Overtime (quarter >= 5) is deliberately folded into the second-half bucket rather
 * than given its own. The bucket exists only to isolate lookback -- a drive
 * cannot span halftime -- and the end of regulation is not a possession break
 * the way halftime is. Splitting overtime out would force a spurious drive
 * boundary at the start of OT; under a per-bucket counter it would also have
 * reintroduced the numbering restart this module was fixed to remove.
 */
export const get_half = (play) => (play.quarter <= 2 ? 1 : 2)

/**
 * Calculates drive_sequence for all plays using nflfastr's fixed_drive methodology.
 *
 * Numbering is game-continuous: the counter runs from 1 to N across the whole
 * game and does NOT reset at halftime. This is the convention every other
 * source in the system uses (nflfastR's fixed_drive, NFL's
 * driveSequenceNumber, Sportradar), and it is what makes the `${esbid}_${drive_sequence}`
 * drive key in drive-play-count-enrichment.mjs -- and the equivalent
 * COUNT(DISTINCT CONCAT(esbid, drive_sequence)) denominators in the data-views rate
 * types -- address a single drive rather than merging one drive per half.
 *
 * Halves are still grouped, but only for boundary detection and lookback
 * isolation: the first play after halftime always starts a new drive, and the
 * prev_play lookback must not reach back across the break.
 *
 * All-or-nothing per game: if any play in the incoming batch for a game already
 * carries a drive_sequence, the enrichment declines to write for that game entirely.
 * A populated value came from a different numbering authority (NFL or
 * Sportradar), which draws drive boundaries differently than nflfastR does.
 * Filling only the gaps splices two methodologies into one sequence that is
 * monotonic but meaningless -- worse than a visible gap, because it looks
 * correct.
 *
 * The all-or-nothing check is scoped to the plays array passed in, NOT to
 * database state, and that distinction is load-bearing. This module is pure and
 * does no database access; a database-scoped check would see the partial state
 * written by the first poll of a live game and decline forever after, freezing
 * drive_sequence at whatever that first partial write contained.
 *
 * @param {Array} plays - Array of play objects, one or more games
 * @returns {Array} Plays with drive_sequence set where the game had none
 */
export const enrich_fixed_drives = (plays) => {
  log(`Starting fixed drive enrichment for ${plays.length} plays`)

  if (plays.length === 0) {
    return plays
  }

  // Group plays by game, retaining half membership within each game.
  const games_map = new Map()

  for (const play of plays) {
    if (!games_map.has(play.esbid)) {
      games_map.set(play.esbid, [])
    }
    games_map.get(play.esbid).push(play)
  }

  const enriched_plays = []

  for (const [esbid, game_plays] of games_map.entries()) {
    const has_existing_drive_seq = game_plays.some(
      (play) =>
        play.drive_sequence !== null && play.drive_sequence !== undefined
    )

    if (has_existing_drive_seq) {
      log(
        `${esbid}: drive_sequence already populated by another source, skipping`
      )
      enriched_plays.push(...game_plays.map((play) => ({ ...play })))
      continue
    }

    const halves = new Map()
    for (const play of game_plays) {
      const half = get_half(play)
      if (!halves.has(half)) {
        halves.set(half, [])
      }
      halves.get(half).push(play)
    }

    // The counter is declared outside the half loop -- this is the
    // game-continuous numbering.
    let drive_number = 0

    for (const half of [...halves.keys()].sort((a, b) => a - b)) {
      const half_plays = halves.get(half)
      // Sort by play_id to ensure correct order
      half_plays.sort((a, b) => a.play_id - b.play_id)

      for (let i = 0; i < half_plays.length; i++) {
        const play = half_plays[i]
        // Lookback is scoped to the half: the first play after halftime has no
        // predecessor and therefore always opens a new drive.
        const prev_play = i > 0 ? half_plays[i - 1] : null
        const prev_play_2 = i > 1 ? half_plays[i - 2] : null
        const prev_play_3 = i > 2 ? half_plays[i - 3] : null

        if (is_new_drive(play, prev_play, prev_play_2, prev_play_3)) {
          drive_number++
        }

        enriched_plays.push({
          ...play,
          drive_sequence: drive_number
        })
      }
    }

    log(`${esbid}: ${drive_number} drives`)
  }

  log('Fixed drive enrichment complete')
  return enriched_plays
}
