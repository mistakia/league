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

export const practice_squad_slots = [
  roster_slot_types.PS,
  roster_slot_types.PSP,
  roster_slot_types.PSD,
  roster_slot_types.PSDP
]
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
