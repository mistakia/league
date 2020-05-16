export function getCurrentTeam (state) {
  const teams = state.get('teams')
  return teams.get(teams.get('currentTeamId'))
}
