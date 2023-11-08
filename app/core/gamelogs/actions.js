export const gamelogsActions = {
  LOAD_PLAYERS_GAMELOGS: 'LOAD_PLAYERS_GAMELOGS',

  GET_PLAYERS_GAMELOGS_FAILED: 'GET_PLAYERS_GAMELOGS_FAILED',
  GET_PLAYERS_GAMELOGS_PENDING: 'GET_PLAYERS_GAMELOGS_PENDING',
  GET_PLAYERS_GAMELOGS_FULFILLED: 'GET_PLAYERS_GAMELOGS_FULFILLED',

  SET_PLAYER_GAMELOGS_ANALYSIS: 'SET_PLAYER_GAMELOGS_ANALYSIS',

  load_players_gamelogs: ({ year, week, nfl_team, opponent, position }) => ({
    type: gamelogsActions.LOAD_PLAYERS_GAMELOGS,
    payload: {
      year,
      week,
      nfl_team,
      opponent,
      position
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
  })
}

export const getPlayersGamelogsActions = {
  failed: gamelogsActions.getPlayersGamelogsFailed,
  pending: gamelogsActions.getPlayersGamelogsPending,
  fulfilled: gamelogsActions.getPlayersGamelogsFulfilled
}
