export const errorActions = {
  REPORT_ERROR: 'REPORT_ERROR',

  POST_ERROR_PENDING: 'POST_ERROR_PENDING',
  POST_ERROR_FAILED: 'POST_ERROR_FAILED',
  POST_ERROR_FULFILLED: 'POST_ERROR_FULFILLED',

  report: ({ message, stack }) => ({
    type: errorActions.REPORT_ERROR,
    payload: {
      message,
      stack
    }
  }),

  postErrorFailed: (opts, error) => ({
    type: errorActions.POST_ERROR_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postErrorPending: (opts) => ({
    type: errorActions.POST_ERROR_PENDING,
    payload: {
      opts
    }
  }),

  postErrorFulfilled: (opts, data) => ({
    type: errorActions.POST_ERROR_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const postErrorActions = {
  failed: errorActions.postErrorFailed,
  pending: errorActions.postErrorPending,
  fulfilled: errorActions.postErrorFulfilled
}
