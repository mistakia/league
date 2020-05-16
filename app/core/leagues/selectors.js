export function getCurrentLeague (state) {
  const leagues = state.get('leagues')
  return leagues.get(leagues.get('currentLeagueId'))
}
