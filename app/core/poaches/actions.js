export const poachActions = {
  POACH_PLAYER: 'POACH_PLAYER',

  POST_POACH_FAILED: 'POST_POACH_FAILED',
  POST_POACH_FULFILLED: 'POST_POACH_FULFILLED',
  POST_POACH_PENDING: 'POST_POACH_PENDING',

  poach: ({ player, drop }) => ({
    type: poachActions.POACH_PLAYER,
    payload: {
      player,
      drop
    }
  }),

  postPoachPending: opts => ({
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
  })
}

export const postPoachActions = {
  failed: poachActions.postPoachFailed,
  pending: poachActions.postPoachPending,
  fulfilled: poachActions.postPoachFulfilled
}
