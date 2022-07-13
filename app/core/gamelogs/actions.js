export const gamelogsActions = {
  GET_PLAYERS_GAMELOGS_FAILED: 'GET_PLAYERS_GAMELOGS_FAILED',
  GET_PLAYERS_GAMELOGS_PENDING: 'GET_PLAYERS_GAMELOGS_PENDING',
  GET_PLAYERS_GAMELOGS_FULFILLED: 'GET_PLAYERS_GAMELOGS_FULFILLED',

  GET_TEAM_GAMELOGS_FAILED: 'GET_TEAM_GAMELOGS_FAILED',
  GET_TEAM_GAMELOGS_PENDING: 'GET_TEAM_GAMELOGS_PENDING',
  GET_TEAM_GAMELOGS_FULFILLED: 'GET_TEAM_GAMELOGS_FULFILLED',

  SET_PLAYER_GAMELOGS_ANALYSIS: 'SET_PLAYER_GAMELOGS_ANALYSIS',
  SET_TEAM_GAMELOGS_ANALYSIS: 'SET_TEAM_GAMELOGS_ANALYSIS',

  setTeamGamelogsAnalysis: (data) => ({
    type: gamelogsActions.SET_TEAM_GAMELOGS_ANALYSIS,
    payload: {
      data
    }
  }),

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
  }),

  getTeamGamelogsFulfilled: (opts, data) => ({
    type: gamelogsActions.GET_TEAM_GAMELOGS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getTeamGamelogsPending: (opts) => ({
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

export const getPlayersGamelogsActions = {
  failed: gamelogsActions.getPlayersGamelogsFailed,
  pending: gamelogsActions.getPlayersGamelogsPending,
  fulfilled: gamelogsActions.getPlayersGamelogsFulfilled
}

export const getTeamGamelogsActions = {
  failed: gamelogsActions.getTeamGamelogsFailed,
  pending: gamelogsActions.getTeamGamelogsPending,
  fulfilled: gamelogsActions.getTeamGamelogsFulfilled
}
