export const statActions = {
  GET_CHARTED_PLAYS_FAILED: 'GET_CHARTED_PLAYS_FAILED',
  GET_CHARTED_PLAYS_PENDING: 'GET_CHARTED_PLAYS_PENDING',
  GET_CHARTED_PLAYS_FULFILLED: 'GET_CHARTED_PLAYS_FULFILLED',

  GET_TEAM_STATS_FAILED: 'GET_TEAM_STATS_FAILED',
  GET_TEAM_STATS_PENDING: 'GET_TEAM_STATS_PENDING',
  GET_TEAM_STATS_FULFILLED: 'GET_TEAM_STATS_FULFILLED',

  SET_TEAM_STATS_PERCENTILES: 'SET_TEAM_STATS_PERCENTILES',

  FILTER_STATS: 'FILTER_STATS',

  UPDATE_QUALIFIER: 'UPDATE_QUALIFIER',

  setTeamStatsPercentiles: (percentiles) => ({
    type: statActions.SET_TEAM_STATS_PERCENTILES,
    payload: {
      percentiles
    }
  }),

  updateQualifier: ({ qualifier, value }) => ({
    type: statActions.UPDATE_QUALIFIER,
    payload: {
      qualifier,
      value
    }
  }),

  filter: ({ type, values }) => ({
    type: statActions.FILTER_STATS,
    payload: {
      type,
      values
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
