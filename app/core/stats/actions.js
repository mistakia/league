export const statActions = {
  GET_CHARTED_PLAYS_FAILED: 'GET_CHARTED_PLAYS_FAILED',
  GET_CHARTED_PLAYS_PENDING: 'GET_CHARTED_PLAYS_PENDING',
  GET_CHARTED_PLAYS_FULFILLED: 'GET_CHARTED_PLAYS_FULFILLED',

  SET_TEAM_STATS_PERCENTILES: 'SET_TEAM_STATS_PERCENTILES',

  FILTER_STATS: 'FILTER_STATS',
  FILTER_STATS_YARDLINE: 'FILTER_STATS_YARDLINE',

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

  filter_yardline: ({ yardline_start, yardline_end }) => ({
    type: statActions.FILTER_STATS_YARDLINE,
    payload: {
      yardline_start,
      yardline_end
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
  })
}

export const getChartedPlaysActions = {
  failed: statActions.getChartedPlaysFailed,
  fulfilled: statActions.getChartedPlaysFulfilled,
  pending: statActions.getChartedPlaysPending
}
