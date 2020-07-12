export const statActions = {
  GET_PLAYS_FAILED: 'GET_PLAYS_FAILED',
  GET_PLAYS_PENDING: 'GET_PLAYS_PENDING',
  GET_PLAYS_FULFILLED: 'GET_PLAYS_FULFILLED',

  SET_STAT_VIEW: 'SET_STAT_VIEW',
  SET_STAT_PASSING_VIEW: 'SET_STAT_PASSING_VIEW',

  GET_TEAM_STATS_FAILED: 'GET_TEAM_STATS_FAILED',
  GET_TEAM_STATS_PENDING: 'GET_TEAM_STATS_PENDING',
  GET_TEAM_STATS_FULFILLED: 'GET_TEAM_STATS_FULFILLED',

  SET_TEAM_STATS: 'SET_TEAM_STATS',

  GET_TEAM_STATS: 'GET_TEAM_STATS',

  FILTER_STATS: 'FILTER_STATS',

  setTeamStats: ({ overall }) => ({
    type: statActions.SET_TEAM_STATS,
    payload: {
      overall
    }
  }),

  filter: (type, value) => ({
    type: statActions.FILTER_STATS,
    payload: {
      type,
      value
    }
  }),

  setView: (view) => ({
    type: statActions.SET_STAT_VIEW,
    payload: {
      view
    }
  }),

  setPassingView: (view) => ({
    type: statActions.SET_STAT_PASSING_VIEW,
    payload: {
      view
    }
  }),

  getPlaysPending: (opts) => ({
    type: statActions.GET_PLAYS_PENDING,
    payload: {
      opts
    }
  }),

  getPlaysFulfilled: (opts, data) => ({
    type: statActions.GET_PLAYS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlaysFailed: (opts, error) => ({
    type: statActions.GET_PLAYS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getTeamStatsPending: (opts) => ({
    type: statActions.GET_TEAM_STATS_PENDING,
    payload: {
      opts
    }
  }),

  getTeamStatsFulfilled: (opts, data) => ({
    type: statActions.GET_TEAM_STATS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getTeamStatsFailed: (opts, error) => ({
    type: statActions.GET_TEAM_STATS_FAILED,
    payload: {
      opts,
      error
    }
  })
}

export const getPlaysActions = {
  failed: statActions.getPlaysFailed,
  fulfilled: statActions.getPlaysFulfilled,
  pending: statActions.getPlaysPending
}

export const getTeamStatActions = {
  failed: statActions.getTeamStatsFailed,
  fulfilled: statActions.getTeamStatsFulfilled,
  pending: statActions.getTeamStatsPending
}
