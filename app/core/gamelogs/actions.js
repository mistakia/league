export const gamelogsActions = {
  GET_PLAYER_GAMELOGS_FAILED: 'GET_PLAYER_GAMELOGS_FAILED',
  GET_PLAYER_GAMELOGS_PENDING: 'GET_PLAYER_GAMELOGS_PENDING',
  GET_PLAYER_GAMELOGS_FULFILLED: 'GET_PLAYER_GAMELOGS_FULFILLED',

  GET_TEAM_GAMELOGS_FAILED: 'GET_TEAM_GAMELOGS_FAILED',
  GET_TEAM_GAMELOGS_PENDING: 'GET_TEAM_GAMELOGS_PENDING',
  GET_TEAM_GAMELOGS_FULFILLED: 'GET_TEAM_GAMELOGS_FULFILLED',

  SET_PLAYER_GAMELOGS_ANALYSIS: 'SET_PLAYER_GAMELOGS_ANALYSIS',
  SET_TEAM_GAMELOGS_ANALYSIS: 'SET_TEAM_GAMELOGS_ANALYSIS',

  setTeamGamelogsAnalysis: data => ({
    type: gamelogsActions.SET_TEAM_GAMELOGS_ANALYSIS,
    payload: {
      data
    }
  }),

  setPlayerGamelogsAnalysis: data => ({
    type: gamelogsActions.SET_PLAYER_GAMELOGS_ANALYSIS,
    payload: {
      data
    }
  }),

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
  }),

  getTeamGamelogsFulfilled: (opts, data) => ({
    type: gamelogsActions.GET_TEAM_GAMELOGS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getTeamGamelogsPending: opts => ({
    type: gamelogsActions.GET_TEAM_GAMELOGS_PENDING,
    payload: {
      opts
    }
  }),

  getTeamGamelogsFailed: (opts, error) => ({
    type: gamelogsActions.GET_TEAM_GAMELOGS_FAILED,
    payload: {
      opts,
      error
    }
  })
}

export const getPlayerGamelogsActions = {
  failed: gamelogsActions.getPlayerGamelogsFailed,
  pending: gamelogsActions.getPlayerGamelogsPending,
  fulfilled: gamelogsActions.getPlayerGamelogsFulfilled
}

export const getTeamGamelogsActions = {
  failed: gamelogsActions.getTeamGamelogsFailed,
  pending: gamelogsActions.getTeamGamelogsPending,
  fulfilled: gamelogsActions.getTeamGamelogsFulfilled
}
