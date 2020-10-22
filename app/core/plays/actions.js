export const playActions = {
  GET_PLAYS_FAILED: 'GET_PLAYS_FAILED',
  GET_PLAYS_PENDING: 'GET_PLAYS_PENDING',
  GET_PLAYS_FULFILLED: 'GET_PLAYS_FULFILLED',

  GET_PLAYSTATS_FAILED: 'GET_PLAYSTATS_FAILED',
  GET_PLAYSTATS_PENDING: 'GET_PLAYSTATS_PENDING',
  GET_PLAYSTATS_FULFILLED: 'GET_PLAYSTATS_FULFILLED',

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
  }),

  getPlayStatsPending: (opts) => ({
    type: playActions.GET_PLAYSTATS_PENDING,
    payload: {
      opts
    }
  }),

  getPlayStatsFulfilled: (opts, data) => ({
    type: playActions.GET_PLAYSTATS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlayStatsFailed: (opts, error) => ({
    type: playActions.GET_PLAYSTATS_FAILED,
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

export const getPlayStatsActions = {
  failed: playActions.getPlayStatsFailed,
  fulfilled: playActions.getPlayStatsFulfilled,
  pending: playActions.getPlayStatsPending
}
