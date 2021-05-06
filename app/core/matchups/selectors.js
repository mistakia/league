import { getTeamById } from '@core/teams'
import { createMatchup } from './matchup'

export function getMatchups(state) {
  return state.get('matchups')
}

export function getMatchupById(state, { mid }) {
  const matchups = state.get('matchups')
  const items = matchups.get('items')
  return items.find((m) => m.uid === mid)
}

export function getFilteredMatchups(state) {
  const matchups = state.get('matchups')
  const items = matchups.get('items')
  const teams = matchups.get('teams')
  const weeks = matchups.get('weeks')
  const filtered = items.filter(
    (m) => teams.includes(m.aid) || teams.includes(m.hid)
  )
  return filtered.filter((m) => weeks.includes(m.week))
}

export function getSelectedMatchup(state) {
  const matchups = state.get('matchups')
  const matchupId = matchups.get('selected')
  if (!matchupId) return createMatchup()

  const week = state.getIn(['scoreboard', 'week'])
  if (week < 14) {
    const items = matchups.get('items')
    return items.find((m) => m.uid === matchupId)
  } else {
    const items = matchups.get('playoffs')
    return items.find((m) => m.uid === matchupId)
  }
}

export function getSelectedMatchupTeams(state) {
  const matchup = getSelectedMatchup(state)
  return matchup.tids.map((tid) => getTeamById(state, { tid }))
}

export function getMatchupsForSelectedWeek(state) {
  const matchups = state.getIn(['matchups', 'items'])
  const week = state.getIn(['scoreboard', 'week'])
  return matchups.filter((m) => m.week === week)
}
