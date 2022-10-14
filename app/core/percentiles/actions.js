export const percentileActions = {
  LOAD_PERCENTILES: 'LOAD_PERCENTILES',

  GET_PERCENTILES_PENDING: 'GET_PERCENTILES_PENDING',
  GET_PERCENTILES_FULFILLED: 'GET_PERCENTILES_FULFILLED',
  GET_PERCENTILES_FAILED: 'GET_PERCENTILES_FAILED',

  loadPercentiles: (percentile_key) => ({
    type: percentileActions.LOAD_PERCENTILES,
    payload: {
      percentile_key
    }
  }),

  getPercentilesPending: (opts) => ({
    type: percentileActions.GET_PERCENTILES_PENDING,
    payload: {
      opts
    }
  }),

  getPercentilesFailed: (opts, error) => ({
    type: percentileActions.GET_PERCENTILES_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getPercentilesFulfilled: (opts, data) => ({
    type: percentileActions.GET_PERCENTILE_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getPercentilesActions = {
  failed: percentileActions.getPercentilesFailed,
  pending: percentileActions.getPercentilesPending,
  fulfilled: percentileActions.getPercentilesFulfilled
}
