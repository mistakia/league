export const scoreboardActions = {
  SCOREBOARD_SELECT_WEEK: 'SCOREBOARD_SELECT_WEEK',

  // websocket events
  SCOREBOARD_REGISTER: 'SCOREBOARD_REGISTER',
  UPDATE_SCOREBOARD_PLAYS: 'UPDATE_SCOREBOARD_PLAYS',

  GET_SCOREBOARD_PENDING: 'GET_SCOREBOARD_PENDING',
  GET_SCOREBOARD_FAILED: 'GET_SCOREBOARD_FAILED',
  GET_SCOREBOARD_FULFILLED: 'GET_SCOREBOARD_FULFILLED',

  selectWeek: (week) => ({
    type: scoreboardActions.SCOREBOARD_SELECT_WEEK,
    payload: {
      week: Number(week)
    }
  }),

  getScoreboardPending: (opts) => ({
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
