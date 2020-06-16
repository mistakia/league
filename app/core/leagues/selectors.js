import { createSelector } from 'reselect'

import { getTeams } from '@core/teams'
import { getApp } from '@core/app'

export function getLeagues (state) {
  return state.get('leagues').toList()
}

export function getCurrentLeague (state) {
  const { leagueId } = getApp(state)
  return state.get('leagues').get(leagueId).toJS()
}

export function getCurrentLeagueTeamIds (state) {
  const { leagueId } = getApp(state)
  return state.get('leagues').get(leagueId).teams
}

export function getLeagueById (state, id) {
  const leagues = state.get('leagues')
  return leagues.get(leagues.get(id))
}

export const getTeamsForCurrentLeague = createSelector(
  getCurrentLeagueTeamIds,
  getTeams,
  (teamIds, teams) => {
    return teamIds.map(tid => teams.get(tid))
  }
)
