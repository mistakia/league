export const gamelogsActions = {
  GET_PLAYERS_GAMELOGS_FAILED: 'GET_PLAYERS_GAMELOGS_FAILED',
  GET_PLAYERS_GAMELOGS_PENDING: 'GET_PLAYERS_GAMELOGS_PENDING',
  GET_PLAYERS_GAMELOGS_FULFILLED: 'GET_PLAYERS_GAMELOGS_FULFILLED',

  SET_PLAYER_GAMELOGS_ANALYSIS: 'SET_PLAYER_GAMELOGS_ANALYSIS',

  setPlayerGamelogsAnalysis: (data) => ({
    type: gamelogsActions.SET_PLAYER_GAMELOGS_ANALYSIS,
    payload: {
      data
    }
  }),

  getPlayersGamelogsFailed: (opts, error) => ({
    type: gamelogsActions.GET_PLAYERS_GAMELOGS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getPlayersGamelogsPending: (opts) => ({
    type: gamelogsActions.GET_PLAYERS_GAMELOGS_PENDING,
    payload: {
      opts
    }
  }),

  getPlayersGamelogsFulfilled: (opts, data) => ({
    type: gamelogsActions.GET_PLAYERS_GAMELOGS_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getPlayersGamelogsActions = {
  failed: gamelogsActions.getPlayersGamelogsFailed,
  pending: gamelogsActions.getPlayersGamelogsPending,
  fulfilled: gamelogsActions.getPlayersGamelogsFulfilled
}
