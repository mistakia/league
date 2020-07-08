export const statActions = {
  GET_PLAYS_FAILED: 'GET_PLAYS_FAILED',
  GET_PLAYS_PENDING: 'GET_PLAYS_PENDING',
  GET_PLAYS_FULFILLED: 'GET_PLAYS_FULFILLED',

  SET_STAT_VIEW: 'SET_STAT_VIEW',
  SET_STAT_PASSING_VIEW: 'SET_STAT_PASSING_VIEW',

  FILTER_STATS: 'FILTER_STATS',

  filter: (type, value) => ({
    type: statActions.FILTER_STATS,
    payload: {
      type,
      value
    }
  }),

  setView: (view) => ({
    type: statActions.SET_STAT_VIEW,
    payload: {
      view
    }
  }),

  setPassingView: (view) => ({
    type: statActions.SET_STAT_PASSING_VIEW,
    payload: {
      view
    }
  }),

  getPlaysPending: (opts) => ({
    type: statActions.GET_PLAYS_PENDING,
    payload: {
      opts
    }
  }),

  getPlaysFulfilled: (opts, data) => ({
    type: statActions.GET_PLAYS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlaysFailed: (opts, error) => ({
    type: statActions.GET_PLAYS_FAILED,
    payload: {
      opts,
      error
    }
  })
}

export const getPlaysActions = {
  failed: statActions.getPlaysFailed,
  fulfilled: statActions.getPlaysFulfilled,
  pending: statActions.getPlaysPending
}
