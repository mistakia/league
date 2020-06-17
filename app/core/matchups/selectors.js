export function getMatchups (state) {
  return state.get('matchups')
}

export function getFilteredMatchups (state) {
  const matchups = state.get('matchups')
  const items = matchups.get('items')
  const teams = matchups.get('teams')
  const weeks = matchups.get('weeks')
  let filtered = items.filter(m => teams.includes(m.aid) || teams.includes(m.hid))
  return filtered.filter(m => weeks.includes(m.week))
}
