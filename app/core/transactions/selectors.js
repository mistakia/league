export function getTransactions (state) {
  return state.get('transactions')
}

export function getReleaseTransactions (state) {
  return getTransactions(state).get('release')
}
