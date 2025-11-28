import { roster_slot_types } from '#constants'

const getPlayerCountBySlot = ({ league }) => {
  const count = {}
  for (const slot of Object.keys(roster_slot_types)) {
    const id = slot.toLowerCase()
    const setting = league[`s${id}`] || league[id] || 0
    count[slot] = setting * league.num_teams
  }

  return count
}

export default getPlayerCountBySlot
