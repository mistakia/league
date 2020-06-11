import { Team } from './team'

export function getTeamById (state, { tid }) {
  const teams = state.get('teams')
  return teams.get(tid) || new Team()
}
