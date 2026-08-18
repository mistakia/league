// Convert the teams Immutable.Map (keyed by team_id) into the array shape the
// restricted free agency schedule helpers consume
export function teams_to_array(teams) {
  if (!teams || typeof teams.toJS !== 'function') return []
  return Object.values(teams.toJS()).map((team) => ({
    team_id: team.team_id,
    draft_order: team.draft_order
  }))
}
