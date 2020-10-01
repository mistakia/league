export const playActions = {
  GET_PLAYS_FAILED: 'GET_PLAYS_FAILED',
  GET_PLAYS_PENDING: 'GET_PLAYS_PENDING',
  GET_PLAYS_FULFILLED: 'GET_PLAYS_FULFILLED',

  getPlaysPending: (opts) => ({
    type: playActions.GET_PLAYS_PENDING,
    payload: {
      opts
    }
  }),

  getPlaysFulfilled: (opts, data) => ({
    type: playActions.GET_PLAYS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlaysFailed: (opts, error) => ({
    type: playActions.GET_PLAYS_FAILED,
    payload: {
      opts,
      error
    }
  })
}

export const getPlaysActions = {
  failed: playActions.getPlaysFailed,
  fulfilled: playActions.getPlaysFulfilled,
  pending: playActions.getPlaysPending
}
