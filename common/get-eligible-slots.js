import { slots } from './constants'

const getEligibleSlots = ({ pos, ps, bench, ir }) => {
  const slotKeys = Object.keys(slots)
  let eligible = []

  if (pos) {
    eligible = eligible.filter(slotKeys.filter(k => k.includes(pos)))
  }

  if (bench) {
    eligible = eligible.concat(slotKeys.filter(k => k.includes('BENCH')))
  }

  if (ps) {
    eligible = eligible.concat(slotKeys.filter(k => k.includes('PS')))
  }

  if (ir) {
    eligible = eligible.concat(slotKeys.filter(k => k.includes('IR')))
  }

  return slotsKeys.map(k => slots[k])
}

export default getEligibleSlots
