import * as constants from './constants.mjs'

const exclude = [
  constants.slots.IR,
  constants.slots.PS,
  constants.slots.PSP,
  constants.slots.PSD,
  constants.slots.PSDP,
  constants.slots.COV
]

const isSlotActive = (slot) => {
  return !exclude.includes(slot)
}

export default isSlotActive
