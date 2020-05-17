export function getTeamById (state, id) {
  const teams = state.get('teams')
  return teams.get(teams.get(id))
}
