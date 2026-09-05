/**
 * nfl_plays columns the Sportradar play importer writes and NO OTHER WRITER
 * TOUCHES, so no precedence question arises for them.
 *
 * This is the third disposition alongside ./sportradar-exclusive-fields.mjs (safe
 * to overwrite) and ./sportradar-protected-fields.mjs (never overwrite). Those two
 * both answer "who wins when two writers disagree"; this one records that the
 * question does not apply, which is a real ruling and not an absence of one.
 *
 * It exists because the field-authority audit on 2026-09-05 found the importer
 * writing 81 columns that neither list named. Every 2025 defect found so far sits
 * in that remainder, and the reason it could accumulate is that "no entry" and "no
 * competing writer" were indistinguishable -- an unruled column and a column that
 * needs no rule looked identical from the code.
 *
 * THE MEMBERSHIP CLAIM IS VERIFIED, NOT ASSERTED.
 * `scripts/audit-sportradar-field-authority.mjs` scans WRITER_CORPUS below for each
 * entry and FAILS when another writer names one. That matters because the failure
 * this file could otherwise reproduce is the one the audit found in the protected
 * list, where 18 of 35 entries named a column the importer does not write and so
 * ruled on nothing while reading as coverage. A hand-maintained "nobody else writes
 * this" list decays the moment a second writer is added, silently and in the
 * dangerous direction.
 */

/**
 * Every module that writes an nfl_plays column, other than the Sportradar importer
 * itself. The audit resolves this list against the tree and fails on a path that no
 * longer exists, so a renamed or deleted writer cannot quietly shrink the corpus a
 * membership claim is checked against.
 */
export const WRITER_CORPUS = [
  'scripts/import-plays-nfl-v1.mjs',
  'scripts/import-plays-nflfastr.mjs',
  'scripts/import-plays-nflfastr-ftn.mjs',
  'scripts/import-plays-charting.mjs',
  'scripts/import-charted-plays-from-csv.mjs',
  'scripts/process-plays.mjs',
  'libs-server/play-enrichment'
]

/**
 * Column -> why no other writer competes for it. The reason is load-bearing: an
 * entry with no stated reason is an allowlist line, and the point of this file is
 * that every column carries a recorded ruling.
 */
export const SPORTRADAR_UNCONTESTED_FIELDS = new Map([
  // Sportradar's play `details` are the only source in this tree that names the
  // individual defenders credited on a sack or a tackle for loss. nflfastR carries
  // the play-level `is_sack` and `is_tackle_for_loss` flags -- which is why those
  // two ARE contested and live in the protected list -- but no participant ids.
  ['sack_player_1_pid', 'only Sportradar names sack participants'],
  ['sack_player_1_gsis', 'only Sportradar names sack participants'],
  ['sack_player_2_pid', 'only Sportradar names sack participants'],
  ['sack_player_2_gsis', 'only Sportradar names sack participants'],
  [
    'tackle_for_loss_1_pid',
    'only Sportradar names tackle-for-loss participants'
  ],
  [
    'tackle_for_loss_1_gsis',
    'only Sportradar names tackle-for-loss participants'
  ],
  [
    'tackle_for_loss_2_pid',
    'only Sportradar names tackle-for-loss participants'
  ],
  [
    'tackle_for_loss_2_gsis',
    'only Sportradar names tackle-for-loss participants'
  ],

  // Same shape for the fumble participants. The fumble EVENT (`is_fumble`,
  // `is_fumble_lost`) is written by the enrichment and is contested; who forced and
  // who recovered it is Sportradar's alone.
  ['fumble_forced_1_pid', 'only Sportradar names the forcing defender'],
  ['fumble_forced_1_gsis', 'only Sportradar names the forcing defender'],
  ['fumble_recovered_1_pid', 'only Sportradar names the recovering player'],
  ['fumble_recovered_1_gsis', 'only Sportradar names the recovering player'],

  // Kicking-game participants and the two yardage figures no other feed carries.
  // Note the asymmetry that makes these safe and their siblings not: the ATTEMPT
  // flags (is_field_goal_attempt, is_punt_attempt, is_kickoff_attempt) come from
  // nflfastR as well, so those are contested, while the player and the yardage on
  // the attempt are Sportradar-only.
  ['kicker_pid', 'only Sportradar names the kicker'],
  ['kicker_gsis', 'only Sportradar names the kicker'],
  ['punter_pid', 'only Sportradar names the punter'],
  ['punter_gsis', 'only Sportradar names the punter'],
  ['returner_pid', 'only Sportradar names the returner'],
  ['returner_gsis', 'only Sportradar names the returner'],
  ['punt_yards', 'only Sportradar carries punt distance'],
  ['kickoff_yards', 'only Sportradar carries kickoff distance'],

  ['is_field_goal_blocked', 'only Sportradar charts a blocked field goal'],
  ['is_punt_fair_catch', 'only Sportradar charts a fair catch']
])

/**
 * @param {string} field_name
 * @returns {boolean} True if Sportradar is the only writer of this column
 */
export const is_sportradar_uncontested_field = (field_name) =>
  SPORTRADAR_UNCONTESTED_FIELDS.has(field_name)
