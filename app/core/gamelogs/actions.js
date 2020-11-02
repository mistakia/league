export const gamelogsActions = {
  GET_GAMELOGS_FAILED: 'GET_GAMELOGS_FAILED',
  GET_GAMELOGS_PENDING: 'GET_GAMELOGS_PENDING',
  GET_GAMELOGS_FULFILLED: 'GET_GAMELOGS_FULFILLED',

  getGamelogsFailed: (opts, error) => ({
    type: gamelogsActions.GET_GAMELOGS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getGamelogsPending: opts => ({
    type: gamelogsActions.GET_GAMELOGS_PENDING,
    payload: {
      opts
    }
  }),

  getGamelogsFulfilled: (opts, data) => ({
    type: gamelogsActions.GET_GAMELOGS_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getGamelogsActions = {
  failed: gamelogsActions.getGamelogsFailed,
  pending: gamelogsActions.getGamelogsPending,
  fulfilled: gamelogsActions.getGamelogsFulfilled
}
