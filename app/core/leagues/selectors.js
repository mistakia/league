export function getLeagues (state) {
  return state.get('leagues').toList()
}

export function getLeagueById (state, id) {
  const leagues = state.get('leagues')
  return leagues.get(leagues.get(id))
}
