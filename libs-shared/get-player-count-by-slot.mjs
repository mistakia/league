import { roster_slot_types, starter_slot_league_columns } from '#constants'

const getPlayerCountBySlot = ({ league }) => {
  const count = {}
  for (const [slot, slot_type] of Object.entries(roster_slot_types)) {
    const setting = league[starter_slot_league_columns[slot_type]] || 0
    count[slot] = setting * league.number_teams
  }

  return count
}

export default getPlayerCountBySlot
