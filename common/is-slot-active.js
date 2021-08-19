import * as constants from './constants'

const exclude = [
  constants.slots.IR,
  constants.slots.PS,
  constants.slots.PSP,
  constants.slots.COV
]

const isSlotActive = (slot) => {
  return !exclude.includes(slot)
}

export default isSlotActive
