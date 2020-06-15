export function getSources (state) {
  return state.get('sources')
}

export function getSourceById (state, { sourceId }) {
  return getSources(state).get(sourceId)
}
