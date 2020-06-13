export function getApp (state) {
  return state.get('app')
}

export function getUserId (state) {
  return getApp(state).userId
}

export function getToken (state) {
  return getApp(state).token
}
