export function getTransactions(state) {
  return state.get('transactions')
}

export function getReleaseTransactions(state) {
  return getTransactions(state).get('release')
}

export function getReserveTransactionsByPlayerId(state, { pid }) {
  return getTransactions(state)
    .get('reserve')
    .filter((t) => t.pid === pid)
    .sort((a, b) => b.timestamp - a.timestamp)
}
