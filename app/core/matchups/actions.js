export const matchupsActions = {
  LOAD_MATCHUPS: 'LOAD_MATCHUPS',

  FILTER_MATCHUPS: 'FILTER_MATCHUPS',

  GET_MATCHUPS_FAILED: 'GET_MATCHUPS_FAILED',
  GET_MATCHUPS_PENDING: 'GET_MATCHUPS_PENDING',
  GET_MATCHUPS_FULFILLED: 'GET_MATCHUPS_FULFILLED',

  filter: (type, values) => ({
    type: matchupsActions.FILTER_MATCHUPS,
    payload: {
      type,
      values
    }
  }),

  loadMatchups: () => ({
    type: matchupsActions.LOAD_MATCHUPS
  }),

  getMatchupsFailed: (opts, error) => ({
    type: matchupsActions.GET_MATCHUPS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getMatchupsFulfilled: (opts, data) => ({
    type: matchupsActions.GET_MATCHUPS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getMatchupsPending: (opts) => ({
    type: matchupsActions.GET_MATCHUPS_PENDING,
    payload: {
      opts
    }
  })
}

export const getMatchupsActions = {
  failed: matchupsActions.getMatchupsFailed,
  pending: matchupsActions.getMatchupsPending,
  fulfilled: matchupsActions.getMatchupsFulfilled
}
