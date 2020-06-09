import { getApp } from '@core/app'

export function getRosters (state) {
  return state.get('rosters')
}

export function getCurrentTeamRoster (state) {
  const rosters = getRosters(state)
  const { teamId } = getApp(state)
  const roster = rosters.get(teamId)
  return roster
}
