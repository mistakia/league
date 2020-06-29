export const sourceActions = {
  UPDATE_SOURCE: 'UPDATE_SOURCE',

  PUT_SOURCE_FAILED: 'PUT_SOURCE_FAILED',
  PUT_SOURCE_PENDING: 'PUT_SOURCE_PENDING',
  PUT_SOURCE_FULFILLED: 'PUT_SOURCE_FULFILLED',

  update: ({ sourceId, weight }) => ({
    type: sourceActions.UPDATE_SOURCE,
    payload: {
      sourceId,
      weight
    }
  }),

  putSourcePending: (opts) => ({
    type: sourceActions.PUT_SOURCE_PENDING,
    payload: {
      opts
    }
  }),

  putSourceFailed: (opts, error) => ({
    type: sourceActions.PUT_SOURCE_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putSourceFulfilled: (opts, data) => ({
    type: sourceActions.PUT_SOURCE_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const putSourceActions = {
  failed: sourceActions.putSourceFailed,
  pending: sourceActions.putSourcePending,
  fulfilled: sourceActions.putSourceFulfilled
}
