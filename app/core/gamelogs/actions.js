export const gamelogsActions = {
  GET_PLAYER_GAMELOGS_FAILED: 'GET_PLAYER_GAMELOGS_FAILED',
  GET_PLAYER_GAMELOGS_PENDING: 'GET_PLAYER_GAMELOGS_PENDING',
  GET_PLAYER_GAMELOGS_FULFILLED: 'GET_PLAYER_GAMELOGS_FULFILLED',

  getPlayerGamelogsFailed: (opts, error) => ({
    type: gamelogsActions.GET_PLAYER_GAMELOGS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getPlayerGamelogsPending: opts => ({
    type: gamelogsActions.GET_PLAYER_GAMELOGS_PENDING,
    payload: {
      opts
    }
  }),

  getPlayerGamelogsFulfilled: (opts, data) => ({
    type: gamelogsActions.GET_PLAYER_GAMELOGS_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getPlayerGamelogsActions = {
  failed: gamelogsActions.getPlayerGamelogsFailed,
  pending: gamelogsActions.getPlayerGamelogsPending,
  fulfilled: gamelogsActions.getPlayerGamelogsFulfilled
}
