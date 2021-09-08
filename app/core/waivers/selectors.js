import { Map, List } from 'immutable'

import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'
import { constants, groupBy } from '@common'

export function getWaivers(state) {
  return state.get('waivers')
}

export function getWaiverById(state, { waiverId }) {
  const waivers = getWaiversForCurrentTeam(state)
  return waivers.get(waiverId)
}

export function getWaiverReportItems(state) {
  const items = state.getIn(['waivers', 'report']).toJS()
  const grouped = groupBy(items, 'player')

  const result = []
  for (const playerId in grouped) {
    const waiver = grouped[playerId].find((w) => w.succ)
    result.push({
      ...waiver,
      waivers: grouped[playerId].filter((w) => !w.succ)
    })
  }
  return result.sort((a, b) => b.bid - a.bid)
}

export function getWaiversForCurrentTeam(state) {
  const { teamId } = getApp(state)
  return state.getIn(['waivers', 'teams', teamId], new Map())
}

export function getWaiverPlayersForCurrentTeam(state) {
  let teamWaivers = getWaiversForCurrentTeam(state) || new Map()
  for (const waiver of teamWaivers.values()) {
    const playerId = waiver.player
    const player = getPlayerById(state, { playerId })
    teamWaivers = teamWaivers.setIn([waiver.uid, 'player'], player)
    if (waiver.release.size) {
      const releases = []
      for (const playerId of waiver.release) {
        const player = getPlayerById(state, { playerId })
        releases.push(player)
      }
      teamWaivers = teamWaivers.setIn(
        [waiver.uid, 'release'],
        new List(releases)
      )
    }
  }

  const waivers = teamWaivers.valueSeq().toList()
  const sorted = waivers.sort(
    (a, b) => b.bid - a.bid || a.po - b.po || a.uid - b.uid
  )
  let poach = new List()
  let active = new List()
  let practice = new List()
  for (const w of sorted) {
    if (w.type === constants.waivers.FREE_AGENCY) {
      active = active.push(w)
    } else if (w.type === constants.waivers.FREE_AGENCY_PRACTICE) {
      practice = practice.push(w)
    } else if (w.type === constants.waivers.POACH) {
      poach = poach.push(w)
    }
  }

  return { poach, active, practice }
}
