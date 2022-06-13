export const poachActions = {
  POACH_PLAYER: 'POACH_PLAYER',

  POST_POACH_FAILED: 'POST_POACH_FAILED',
  POST_POACH_FULFILLED: 'POST_POACH_FULFILLED',
  POST_POACH_PENDING: 'POST_POACH_PENDING',

  PUT_POACH_FAILED: 'PUT_POACH_FAILED',
  PUT_POACH_PENDING: 'PUT_POACH_PENDING',
  PUT_POACH_FULFILLED: 'PUT_POACH_FULFILLED',

  UPDATE_POACH: 'UPDATE_POACH',

  update: ({ poachId, release }) => ({
    type: poachActions.UPDATE_POACH,
    payload: {
      poachId,
      release
    }
  }),

  poach: ({ pid, release }) => ({
    type: poachActions.POACH_PLAYER,
    payload: {
      pid,
      release
    }
  }),

  postPoachPending: (opts) => ({
    type: poachActions.POST_POACH_PENDING,
    payload: {
      opts
    }
  }),

  postPoachFulfilled: (opts, data) => ({
    type: poachActions.POST_POACH_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postPoachFailed: (opts, error) => ({
    type: poachActions.POST_POACH_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putPoachFailed: (opts, error) => ({
    type: poachActions.PUT_POACH_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putPoachFulfilled: (opts, data) => ({
    type: poachActions.PUT_POACH_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  putPoachPending: (opts) => ({
    type: poachActions.PUT_POACH_PENDING,
    payload: {
      opts
    }
  })
}

export const postPoachActions = {
  failed: poachActions.postPoachFailed,
  pending: poachActions.postPoachPending,
  fulfilled: poachActions.postPoachFulfilled
}

export const putPoachActions = {
  failed: poachActions.putPoachFailed,
  pending: poachActions.putPoachPending,
  fulfilled: poachActions.putPoachFulfilled
}
