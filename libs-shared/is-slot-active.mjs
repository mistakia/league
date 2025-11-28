import { roster_slot_types } from '#constants'

const exclude = [
  roster_slot_types.RESERVE_SHORT_TERM,
  roster_slot_types.PS,
  roster_slot_types.PSP,
  roster_slot_types.PSD,
  roster_slot_types.PSDP,
  roster_slot_types.COV,
  roster_slot_types.RESERVE_LONG_TERM
]

const isSlotActive = (slot) => {
  return !exclude.includes(slot)
}

export default isSlotActive
