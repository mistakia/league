// Convert the teams Immutable.Map (keyed by uid) into the array shape the
// restricted free agency schedule helpers consume
export function teams_to_array(teams) {
  if (!teams || typeof teams.toJS !== 'function') return []
  return Object.values(teams.toJS()).map((team) => ({
    uid: team.uid,
    draft_order: team.draft_order
  }))
}
