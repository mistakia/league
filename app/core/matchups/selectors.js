import { Map } from 'immutable'

import { constants } from '@common'
import { getApp } from '@core/app'

export function getMatchups (state) {
  return state.get('matchups')
}

export function getFilteredMatchups (state) {
  const matchups = state.get('matchups')
  const items = matchups.get('items')
  const teams = matchups.get('teams')
  const weeks = matchups.get('weeks')
  const filtered = items.filter(m => teams.includes(m.aid) || teams.includes(m.hid))
  return filtered.filter(m => weeks.includes(m.week))
}

export function getCurrentMatchup (state) {
  const matchups = state.getIn(['matchups', 'items'])
  const { teamId } = getApp(state)
  const week = constants.season.week || 1
  const matchup = matchups.find(m => (m.aid === teamId || m.hid === teamId) && m.week === week)
  if (!matchup) {
    return new Map()
  }
  return matchup
}

export function getSelectedMatchup (state) {
  const matchups = state.get('matchups')
  const matchupId = matchups.get('selected')
  if (!matchupId) return null

  const items = matchups.get('items')
  return items.find(m => m.uid === matchupId)
}

export function getMatchupsForCurrentWeek (state) {
  const matchups = state.getIn(['matchups', 'items'])
  const week = constants.season.week || 1
  return matchups.filter(m => m.week === week)
}
