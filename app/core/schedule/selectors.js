export function getSchedule (state) {
  return state.get('schedule')
}

export function getByeByTeam (state, { team }) {
  return state.getIn(['schedule', 'teams', team, 'bye'])
}
