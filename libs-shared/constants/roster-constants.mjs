export const roster_slot_types = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  WRTE: 5,
  RBWR: 6,
  RBWRTE: 7,
  QBRBWRTE: 8,
  K: 9,
  DST: 10,
  BENCH: 11,
  PS: 12, // practice squad - signed
  RESERVE_SHORT_TERM: 13, // short-term injured reserve
  COV: 14,
  PSP: 15, // practice squad - signed and protected
  PSD: 16, // practice squad - drafted
  PSDP: 17, // practice squad - drafted and protected
  RESERVE_LONG_TERM: 18 // long-term injured reserve
}

export const starting_lineup_slots = [
  roster_slot_types.QB,
  roster_slot_types.RB,
  roster_slot_types.WR,
  roster_slot_types.TE,
  roster_slot_types.WRTE,
  roster_slot_types.RBWR,
  roster_slot_types.RBWRTE,
  roster_slot_types.QBRBWRTE,
  roster_slot_types.K,
  roster_slot_types.DST
]

// Active roster slots: starting lineup + bench (excludes practice squad and reserves)
export const active_roster_slots = [
  ...starting_lineup_slots,
  roster_slot_types.BENCH
]

// League-config keys holding the number of starters at each starting slot.
// Enumerated rather than derived by prefix: the league object also carries
// unrelated s-prefixed fields (salary_attribution_rule, sleeper_id,
// scoring_format_id) that must not be summed into a starter count. Most of
// these conformed to full-word `starter_slots_*` columns; `starter_slots_running_back_wide_receiver_tight_end_flex` and
// `starter_slots_superflex` were not part of that rename and still carry their shorthand
// names -- see league_formats in the schema.
export const starting_lineup_slot_league_keys = [
  'starter_slots_quarterback',
  'starter_slots_running_back',
  'starter_slots_wide_receiver',
  'starter_slots_tight_end',
  'starter_slots_wide_receiver_tight_end_flex',
  'starter_slots_running_back_wide_receiver_flex',
  'starter_slots_running_back_wide_receiver_tight_end_flex',
  'starter_slots_superflex',
  'starter_slots_kicker',
  'starter_slots_defense_special_teams'
]

// League-config column for each roster slot's starting-lineup/bench/practice-
// squad count. Keyed by roster_slot_types VALUE so a caller looks up
// `league[column]` directly instead of deriving the column name from the slot
// by string concatenation (`` `s${slot}` ``) -- that concatenation broke
// silently the moment a column's physical name diverged from the bare
// `s`-prefix pattern (see starter_slots_* above vs. the retained
// starter_slots_running_back_wide_receiver_tight_end_flex/starter_slots_superflex shorthand).
export const starter_slot_league_columns = {
  [roster_slot_types.QB]: 'starter_slots_quarterback',
  [roster_slot_types.RB]: 'starter_slots_running_back',
  [roster_slot_types.WR]: 'starter_slots_wide_receiver',
  [roster_slot_types.TE]: 'starter_slots_tight_end',
  [roster_slot_types.WRTE]: 'starter_slots_wide_receiver_tight_end_flex',
  [roster_slot_types.RBWR]: 'starter_slots_running_back_wide_receiver_flex',
  [roster_slot_types.RBWRTE]:
    'starter_slots_running_back_wide_receiver_tight_end_flex',
  [roster_slot_types.QBRBWRTE]: 'starter_slots_superflex',
  [roster_slot_types.K]: 'starter_slots_kicker',
  [roster_slot_types.DST]: 'starter_slots_defense_special_teams',
  [roster_slot_types.BENCH]: 'bench_slot_count',
  [roster_slot_types.PS]: 'practice_squad_slot_count'
}

// League-config column holding the maximum roster count at each POSITION.
// Same shape and same reason as starter_slot_league_columns above:
// `has_position_capacity` derived this by concatenation
// (`` `max_roster_${pos.toLowerCase()}` ``), which broke silently the moment the
// 2026-08-16 position-code conform moved the columns to full words -- the lookup
// returned undefined, `!limit` read as "no limit configured", and every position
// limit passed. A roster-limit check that fails OPEN is the worst direction, and
// no column-existence check can see a computed key.
//
// Keyed by the player POSITION value rather than by roster slot, which is what
// the caller holds.
export const max_roster_league_columns = {
  QB: 'max_roster_quarterback',
  RB: 'max_roster_running_back',
  WR: 'max_roster_wide_receiver',
  TE: 'max_roster_tight_end',
  K: 'max_roster_kicker',
  DST: 'max_roster_defense_special_teams'
}

export const practice_squad_slots = [
  roster_slot_types.PS,
  roster_slot_types.PSP,
  roster_slot_types.PSD,
  roster_slot_types.PSDP
]

export const reserve_slots = [
  roster_slot_types.RESERVE_SHORT_TERM,
  roster_slot_types.RESERVE_LONG_TERM,
  roster_slot_types.COV
]

export const reserve_short_term_slots = [roster_slot_types.RESERVE_SHORT_TERM]
export const practice_squad_protected_slots = [
  roster_slot_types.PSP,
  roster_slot_types.PSDP
]
export const practice_squad_unprotected_slots = [
  roster_slot_types.PS,
  roster_slot_types.PSD
]
export const practice_squad_signed_slots = [
  roster_slot_types.PS,
  roster_slot_types.PSP
]
export const practice_squad_drafted_slots = [
  roster_slot_types.PSD,
  roster_slot_types.PSDP
]

export const roster_slot_display_names = {
  [roster_slot_types.QB]: 'QB',
  [roster_slot_types.RB]: 'RB',
  [roster_slot_types.WR]: 'WR',
  [roster_slot_types.TE]: 'TE',
  [roster_slot_types.WRTE]: 'WR/TE',
  [roster_slot_types.RBWR]: 'RB/WR',
  [roster_slot_types.RBWRTE]: 'FLEX',
  [roster_slot_types.QBRBWRTE]: 'SFLEX',
  [roster_slot_types.K]: 'K',
  [roster_slot_types.DST]: 'DST',
  [roster_slot_types.BENCH]: 'BE',
  [roster_slot_types.PS]: 'PS',
  [roster_slot_types.RESERVE_SHORT_TERM]: 'IR',
  [roster_slot_types.COV]: 'COV',
  [roster_slot_types.PSP]: 'PS (P)',
  [roster_slot_types.PSD]: 'PSD',
  [roster_slot_types.PSDP]: 'PSD (P)',
  [roster_slot_types.RESERVE_LONG_TERM]: 'IR (LT)'
}

export const player_availability_statuses = [
  'ACTIVE ROSTER',
  'FREE AGENT',
  'PRACTICE SQUAD',
  'PRACTICE SQUAD PROTECTED',
  'PRACTICE SQUAD UNPROTECTED',
  'INJURED RESERVE',
  'RESTRICTED FREE AGENT',
  'POTENTIAL FREE AGENT'
]

// Reverse lookup: slot number -> slot name
export const slot_to_name = Object.fromEntries(
  Object.entries(roster_slot_types).map(([name, value]) => [value, name])
)

/**
 * Check if a player position is eligible for a specific slot.
 * @param {string} position - Player position (QB, RB, WR, TE, K, DST)
 * @param {number} slot - Slot type number from roster_slot_types
 * @returns {boolean} True if position can fill the slot
 */
export function is_position_eligible_for_slot(position, slot) {
  // Bench can hold any position
  if (slot === roster_slot_types.BENCH) {
    return true
  }

  const slot_name = slot_to_name[slot]
  if (!slot_name) {
    return false
  }

  // Starting lineup slots: position must be in the slot name
  // e.g., WR can fill WR, WRTE, RBWR, RBWRTE, QBRBWRTE
  // DST only fills DST slot, K only fills K slot
  return slot_name.includes(position)
}
