/**
 * Canonical NFL roster-position vocabulary.
 *
 * Every position column in the schema stores one of `position_vocabulary`. Vendor
 * spellings are folded in by `normalize_position` at the write site; the database
 * CHECK constraints are the backstop.
 *
 * This is roster position only. Depth-chart slots (`player.position_depth`),
 * alignment (`nfl_plays_player.ngs_position`) and fantasy roster slots
 * (`FLEX`, `BN`, `TAXI`) are separate vocabularies and do not belong here.
 */

// Coarse groups. Every group is itself a legal stored value -- historical rows
// carry the group where the detail was never recorded.
export const position_groups = [
  'QB',
  'RB',
  'WR',
  'TE',
  'OL',
  'DL',
  'LB',
  'DB',
  'K',
  'P',
  'LS',
  'DST'
]

// Detail members by group. A group with no finer breakdown maps to an empty list.
export const position_group_members = {
  QB: [],
  RB: ['FB'],
  WR: [],
  TE: [],
  OL: ['T', 'G', 'C'],
  DL: ['DE', 'DT', 'NT', 'EDGE'],
  LB: ['OLB', 'ILB', 'MLB'],
  DB: ['CB', 'S'],
  K: [],
  P: [],
  LS: [],
  DST: []
}

// The 25 legal stored values: every group, plus every detail member.
export const position_vocabulary = position_groups.concat(
  position_groups.flatMap((group) => position_group_members[group])
)

// Total over `position_vocabulary` -- a group maps to itself, which is what makes
// a GROUP BY on this map complete.
export const group_for_position = Object.fromEntries(
  position_groups.flatMap((group) => [
    [group, group],
    ...position_group_members[group].map((member) => [member, group])
  ])
)

// Vendor and historical spellings. Keys are never legal stored values; values
// always are. Includes the single-wing-era codes carried by pre-1950 player rows
// and the side-qualified codes parsed out of NFL gamebooks.
export const position_alias_map = {
  // offensive line
  OT: 'T',
  LT: 'T',
  RT: 'T',
  OG: 'G',
  LG: 'G',
  RG: 'G',
  OC: 'C',

  // defensive line
  ED: 'EDGE',
  LDE: 'DE',
  RDE: 'DE',
  DI: 'DT',
  DG: 'DT',
  LDT: 'DT',
  RDT: 'DT',

  // linebacker
  MIKE: 'MLB',
  WILL: 'OLB',
  LOLB: 'OLB',
  ROLB: 'OLB',
  LILB: 'ILB',
  RILB: 'ILB',
  $LB: 'LB',

  // defensive back
  SS: 'S',
  FS: 'S',
  SAF: 'S',
  LCB: 'CB',
  RCB: 'CB',

  // backfield, including single-wing spellings
  HB: 'RB',
  'H-B': 'RB',
  TB: 'RB',
  BB: 'RB',
  WB: 'RB',

  // receiver and end, including single-wing spellings
  OE: 'TE',
  E: 'TE',
  FL: 'WR',

  // team defense
  DEF: 'DST'
}

/**
 * Fold a raw position value into the canonical vocabulary.
 *
 * Absent values pass through as null -- `props_index.player_position` is NULL on
 * 260,004 of 260,033 rows, and empty string is how `player.tertiary_position`
 * spells absent on 12,307 rows.
 *
 * Anything else that does not resolve throws. That is the gate: a new vendor
 * spelling fails at the write site with a usable stack rather than at the
 * database constraint.
 */
export const normalize_position = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  const candidate = String(value).trim().toUpperCase()
  if (!candidate) {
    return null
  }

  if (group_for_position[candidate]) {
    return candidate
  }

  const alias = position_alias_map[candidate]
  if (alias) {
    return alias
  }

  throw new Error(`unmapped position value: ${JSON.stringify(value)}`)
}

/**
 * The coarse group for a raw or canonical position value. Absent values pass
 * through as null; unmapped values throw, via `normalize_position`.
 */
export const get_position_group = (value) => {
  const position = normalize_position(value)
  return position === null ? null : group_for_position[position]
}
