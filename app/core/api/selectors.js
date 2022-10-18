export function getRequestHistory(state) {
  return state.getIn(['api', 'request_history'])
}
