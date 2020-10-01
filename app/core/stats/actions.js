export const statActions = {
  GET_CHARTED_PLAYS_FAILED: 'GET_CHARTED_PLAYS_FAILED',
  GET_CHARTED_PLAYS_PENDING: 'GET_CHARTED_PLAYS_PENDING',
  GET_CHARTED_PLAYS_FULFILLED: 'GET_CHARTED_PLAYS_FULFILLED',

  SET_STAT_VIEW: 'SET_STAT_VIEW',
  SET_STAT_PASSING_VIEW: 'SET_STAT_PASSING_VIEW',

  GET_TEAM_STATS_FAILED: 'GET_TEAM_STATS_FAILED',
  GET_TEAM_STATS_PENDING: 'GET_TEAM_STATS_PENDING',
  GET_TEAM_STATS_FULFILLED: 'GET_TEAM_STATS_FULFILLED',

  SET_TEAM_STATS: 'SET_TEAM_STATS',

  GET_TEAM_STATS: 'GET_TEAM_STATS',

  FILTER_STATS: 'FILTER_STATS',

  UPDATE_QUALIFIER: 'UPDATE_QUALIFIER',

  setTeamStats: ({ overall }) => ({
    type: statActions.SET_TEAM_STATS,
    payload: {
      overall
    }
  }),

  updateQualifier: ({ qualifier, value }) => ({
    type: statActions.UPDATE_QUALIFIER,
    payload: {
      qualifier,
      value
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

  getChartedPlaysPending: (opts) => ({
    type: statActions.GET_CHARTED_PLAYS_PENDING,
    payload: {
      opts
    }
  }),

  getChartedPlaysFulfilled: (opts, data) => ({
    type: statActions.GET_CHARTED_PLAYS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getChartedPlaysFailed: (opts, error) => ({
    type: statActions.GET_CHARTED_PLAYS_FAILED,
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

export const getChartedPlaysActions = {
  failed: statActions.getChartedPlaysFailed,
  fulfilled: statActions.getChartedPlaysFulfilled,
  pending: statActions.getChartedPlaysPending
}

export const getTeamStatActions = {
  failed: statActions.getTeamStatsFailed,
  fulfilled: statActions.getTeamStatsFulfilled,
  pending: statActions.getTeamStatsPending
}
