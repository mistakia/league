export const scoreboardActions = {
  LOAD_SCOREBOARD: 'LOAD_SCOREBOARD',

  GET_SCOREBOARD_PENDING: 'GET_SCOREBOARD_PENDING',
  GET_SCOREBOARD_FAILED: 'GET_SCOREBOARD_FAILED',
  GET_SCOREBOARD_FULFILLED: 'GET_SCOREBOARD_FULFILLED',

  load: () => ({
    type: scoreboardActions.LOAD_SCOREBOARD
  }),

  getScoreboardPending: opts => ({
    type: scoreboardActions.GET_SCOREBOARD_PENDING,
    payload: {
      opts
    }
  }),

  getScoreboardFailed: (opts, error) => ({
    type: scoreboardActions.GET_SCOREBOARD_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getScoreboardFulfilled: (opts, data) => ({
    type: scoreboardActions.GET_SCOREBOARD_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getScoreboardActions = {
  pending: scoreboardActions.getScoreboardPending,
  failed: scoreboardActions.getScoreboardFailed,
  fulfilled: scoreboardActions.getScoreboardFulfilled
}
