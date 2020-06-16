import { List } from 'immutable'

import { getEligibleSlots, constants } from '@common'
import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'

import { Roster } from './roster'

export function getRosters (state) {
  return state.get('rosters')
}

export function getCurrentTeamRoster (state) {
  const rosters = getRosters(state)
  const { teamId } = getApp(state)
  const roster = rosters.get(teamId)
  return roster || new Roster()
}

export function getCurrentPlayers (state) {
  const rosters = getRosters(state)
  const { teamId, leagueId } = getApp(state)
  const league = state.get('leagues').get(leagueId)
  const roster = rosters.get(teamId)
  if (!roster) {
    return { active: new List(), practice: new List() }
  }


  const psSlots = getEligibleSlots({ ps: true, league })
  const psSlotNums = psSlots.map(s => constants.slots[s])
  let active = new List()
  let practice = new List()

  for (const [key, value] of roster.toSeq()) {
    if (key.startsWith('s')) {
      const playerId = roster.get(key)
      const player = getPlayerById(state, { playerId })
      if (player.player) {
        const slot = parseInt(key.substring(1), 10)
        if (psSlotNums.includes(slot)) {
          practice = practice.push(player)
        } else {
          active = active.push(player)
        }
      }
    }
  }

  return { active, practice }
}
