import { Team } from './team'

export function getTeams (state) {
  return state.get('teams')
}

export function getTeamById (state, { tid }) {
  const teams = state.get('teams')
  return teams.get(tid) || new Team()
}
