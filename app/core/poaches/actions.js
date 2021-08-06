export const poachActions = {
  POACH_PLAYER: 'POACH_PLAYER',

  POST_POACH_FAILED: 'POST_POACH_FAILED',
  POST_POACH_FULFILLED: 'POST_POACH_FULFILLED',
  POST_POACH_PENDING: 'POST_POACH_PENDING',

  poach: ({ player, release }) => ({
    type: poachActions.POACH_PLAYER,
    payload: {
      player,
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
  })
}

export const postPoachActions = {
  failed: poachActions.postPoachFailed,
  pending: poachActions.postPoachPending,
  fulfilled: poachActions.postPoachFulfilled
}
