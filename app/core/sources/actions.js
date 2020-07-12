export const sourceActions = {
  UPDATE_SOURCE: 'UPDATE_SOURCE',

  SET_SOURCE: 'SET_SOURCE',

  GET_SOURCES_FAILED: 'GET_SOURCES_FAILED',
  GET_SOURCES_PENDING: 'GET_SOURCES_PENDING',
  GET_SOURCES_FULFILLED: 'GET_SOURCES_FULFILLED',

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

  set: (opts) => ({
    type: sourceActions.SET_SOURCE,
    payload: {
      opts
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
  }),

  getSourcesPending: (opts) => ({
    type: sourceActions.GET_SOURCES_PENDING,
    payload: {
      opts
    }
  }),

  getSourcesFulfilled: (opts, data) => ({
    type: sourceActions.GET_SOURCES_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getSourcesFailed: (opts, error) => ({
    type: sourceActions.GET_SOURCES_FAILED,
    payload: {
      opts,
      error
    }
  })
}

export const putSourceActions = {
  failed: sourceActions.putSourceFailed,
  pending: sourceActions.putSourcePending,
  fulfilled: sourceActions.putSourceFulfilled
}

export const getSourcesActions = {
  failed: sourceActions.getSourcesFailed,
  pending: sourceActions.getSourcesPending,
  fulfilled: sourceActions.getSourcesFulfilled
}
