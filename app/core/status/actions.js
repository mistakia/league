export const statusActions = {
  LOAD_STATUS: 'LOAD_STATUS',

  GET_STATUS_PENDING: 'GET_STATUS_PENDING',
  GET_STATUS_FAILED: 'GET_STATUS_FAILED',
  GET_STATUS_FULFILLED: 'GET_STATUS_FULFILLED',

  load: () => ({
    type: statusActions.LOAD_STATUS
  }),

  getStatusPending: (opts) => ({
    type: statusActions.GET_STATUS_PENDING,
    payload: {
      opts
    }
  }),

  getStatusFailed: (opts, error) => ({
    type: statusActions.GET_STATUS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getStatusFulfilled: (opts, data) => ({
    type: statusActions.GET_STATUS_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getStatusActions = {
  pending: statusActions.getStatusPending,
  failed: statusActions.getStatusFailed,
  fulfilled: statusActions.getStatusFulfilled
}
