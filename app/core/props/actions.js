export const propActions = {
  LOAD_PROPS: 'LOAD_PROPS',

  GET_PROPS_PENDING: 'GET_PROPS_PENDING',
  GET_PROPS_FULFILLED: 'GET_PROPS_FULFILLED',
  GET_PROPS_FAILED: 'GET_PROPS_FAILED',

  load: () => ({
    type: propActions.LOAD_PROPS
  }),

  getPropsPending: (opts) => ({
    type: propActions.GET_PROPS_PENDING,
    payload: {
      opts
    }
  }),

  getPropsFailed: (opts, error) => ({
    type: propActions.GET_PROPS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getPropsFulfilled: (opts, data) => ({
    type: propActions.GET_PROPS_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getPropsActions = {
  failed: propActions.getPropsFailed,
  pending: propActions.getPropsPending,
  fulfilled: propActions.getPropsFulfilled
}
