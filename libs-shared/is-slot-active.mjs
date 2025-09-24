import * as constants from './constants.mjs'

const exclude = [
  constants.slots.RESERVE_SHORT_TERM,
  constants.slots.PS,
  constants.slots.PSP,
  constants.slots.PSD,
  constants.slots.PSDP,
  constants.slots.COV,
  constants.slots.RESERVE_LONG_TERM
]

const isSlotActive = (slot) => {
  return !exclude.includes(slot)
}

export default isSlotActive
