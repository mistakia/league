export const transactionsActions = {
  FILTER_TRANSACTIONS: 'FILTER_TRANSACTIONS',

  LOAD_TRANSACTIONS: 'LOAD_TRANSACTIONS',
  LOAD_NEXT_TRANSACTIONS: 'LOAD_NEXT_TRANSACTIONS',

  GET_TRANSACTIONS_PENDING: 'GET_TRANSACTIONS_PENDING',
  GET_TRANSACTIONS_FULFILLED: 'GET_TRANSACTIONS_FULFILLED',
  GET_TRANSACTIONS_FAILED: 'GET_TRANSACTIONS_FAILED',

  GET_RELEASE_TRANSACTIONS_PENDING: 'GET_RELEASE_TRANSACTIONS_PENDING',
  GET_RELEASE_TRANSACTIONS_FULFILLED: 'GET_RELEASE_TRANSACTIONS_FULFILLED',
  GET_RELEASE_TRANSACTIONS_FAILED: 'GET_RELEASE_TRANSACTIONS_FAILED',

  filter: (type, values) => ({
    type: transactionsActions.FILTER_TRANSACTIONS,
    payload: {
      type,
      values
    }
  }),

  load: () => ({
    type: transactionsActions.LOAD_TRANSACTIONS
  }),

  loadNext: () => ({
    type: transactionsActions.LOAD_NEXT_TRANSACTIONS
  }),

  getTransactionsPending: (opts) => ({
    type: transactionsActions.GET_TRANSACTIONS_PENDING,
    payload: {
      opts
    }
  }),

  getTransactionsFulfilled: (opts, data) => ({
    type: transactionsActions.GET_TRANSACTIONS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getTransactionsFailed: (opts, error) => ({
    type: transactionsActions.GET_TRANSACTIONS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getReleaseTransactionsPending: (opts) => ({
    type: transactionsActions.GET_RELEASE_TRANSACTIONS_PENDING,
    payload: {
      opts
    }
  }),

  getReleaseTransactionsFailed: (opts, error) => ({
    type: transactionsActions.GET_RELEASE_TRANSACTIONS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getReleaseTransactionsFulfilled: (opts, data) => ({
    type: transactionsActions.GET_RELEASE_TRANSACTIONS_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getTransactionsActions = {
  failed: transactionsActions.getTransactionsFailed,
  pending: transactionsActions.getTransactionsPending,
  fulfilled: transactionsActions.getTransactionsFulfilled
}

export const getReleaseTransactionsActions = {
  failed: transactionsActions.getReleaseTransactionsFailed,
  pending: transactionsActions.getReleaseTransactionsPending,
  fulfilled: transactionsActions.getReleaseTransactionsFulfilled
}
