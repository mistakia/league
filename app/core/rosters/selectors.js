import { List } from 'immutable'

import { getEligibleSlots, constants, Roster } from '@common'
import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'
import { getCurrentLeague } from '@core/leagues'

import { Roster as RosterRecord } from './roster'

export function getRosters (state) {
  return state.get('rosters')
}

export function getRosteredPlayersForCurrentLeague (state) {
  const rosters = getRosters(state)
  const { leagueId } = getApp(state)
  const leagueRosters = rosters.filter(r => r.lid === leagueId)

  const players = []
  for (const roster of leagueRosters.values()) {
    for (const [key, value] of roster.entries()) {
      if (key.startsWith('s')) {
        players.push(value)
      }
    }
  }
  return new List(players)
}

export function isPlayerAvailable (state, { player }) {
  const rostered = getRosteredPlayersForCurrentLeague(state)
  return !rostered.includes(player.player)
}

export function isPlayerEligible (state, { player }) {
  const roster = getCurrentTeamRoster(state)
  const league = getCurrentLeague(state)
  const eligibleSlots = getEligibleSlots({ league, bench: true, pos: player.pos1 })
  const ros = new Roster(roster.toJS())
  return !!ros.getOpenSlots(eligibleSlots).length
}

export function getCurrentTeamRoster (state) {
  const rosters = getRosters(state)
  const { teamId } = getApp(state)
  const roster = rosters.get(teamId)
  return roster || new RosterRecord()
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

  for (const [key] of roster.toSeq()) {
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
