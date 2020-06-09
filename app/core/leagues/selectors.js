import { getApp } from '@core/app'

export function getLeagues (state) {
  return state.get('leagues').toList()
}

export function getCurrentLeague (state) {
  const { leagueId } = getApp(state)
  return state.get('leagues').get(leagueId).toJS()
}

export function getLeagueById (state, id) {
  const leagues = state.get('leagues')
  return leagues.get(leagues.get(id))
}
