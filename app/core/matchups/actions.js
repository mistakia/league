export const matchupsActions = {
  LOAD_MATCHUPS: 'LOAD_MATCHUPS',
  GENERATE_MATCHUPS: 'GENERATE_MATCHUPS',

  FILTER_MATCHUPS: 'FILTER_MATCHUPS',

  GET_MATCHUPS_FAILED: 'GET_MATCHUPS_FAILED',
  GET_MATCHUPS_PENDING: 'GET_MATCHUPS_PENDING',
  GET_MATCHUPS_FULFILLED: 'GET_MATCHUPS_FULFILLED',

  POST_MATCHUPS_FAILED: 'POST_MATCHUPS_FAILED',
  POST_MATCHUPS_PENDING: 'POST_MATCHUPS_PENDING',
  POST_MATCHUPS_FULFILLED: 'POST_MATCHUPS_FULFILLED',

  filter: (type, values) => ({
    type: matchupsActions.FILTER_MATCHUPS,
    payload: {
      type,
      values
    }
  }),

  generate: (leagueId) => ({
    type: matchupsActions.GENERATE_MATCHUPS,
    payload: {
      leagueId
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
  }),

  postMatchupsFailed: (opts, error) => ({
    type: matchupsActions.POST_MATCHUPS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postMatchupsPending: (opts) => ({
    type: matchupsActions.POST_MATCHUPS_PENDING,
    payload: {
      opts
    }
  }),

  postMatchupsFulfilled: (opts, data) => ({
    type: matchupsActions.POST_MATCHUPS_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getMatchupsActions = {
  failed: matchupsActions.getMatchupsFailed,
  pending: matchupsActions.getMatchupsPending,
  fulfilled: matchupsActions.getMatchupsFulfilled
}

export const postMatchupsActions = {
  failed: matchupsActions.postMatchupsFailed,
  pending: matchupsActions.postMatchupsPending,
  fulfilled: matchupsActions.postMatchupsFulfilled
}
