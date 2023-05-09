import { slots } from './constants.mjs'

const getPlayerCountBySlot = ({ league }) => {
  const count = {}
  for (const slot of Object.keys(slots)) {
    const id = slot.toLowerCase()
    const setting = league[`s${id}`] || league[id] || 0
    count[slot] = setting * league.num_teams
  }

  return count
}

export default getPlayerCountBySlot
