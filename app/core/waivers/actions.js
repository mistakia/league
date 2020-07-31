export const waiverActions = {
  WAIVER_CLAIM: 'WAIVER_CLAIM',

  POST_WAIVER_FAILED: 'POST_WAIVER_FAILED',
  POST_WAIVER_FULFILLED: 'POST_WAIVER_FULFILLED',
  POST_WAIVER_PENDING: 'POST_WAIVER_PENDING',

  claim: ({ player, bid, drop, type }) => ({
    type: waiverActions.WAIVER_CLAIM,
    payload: {
      player,
      bid,
      drop,
      type
    }
  }),

  postWaiverPending: opts => ({
    type: waiverActions.POST_WAIVER_PENDING,
    payload: {
      opts
    }
  }),

  postWaiverFulfilled: (opts, data) => ({
    type: waiverActions.POST_WAIVER_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postWaiverFailed: (opts, error) => ({
    type: waiverActions.POST_WAIVER_FAILED,
    payload: {
      opts,
      error
    }
  })
}

export const postWaiverActions = {
  failed: waiverActions.postWaiverFailed,
  pending: waiverActions.postWaiverPending,
  fulfilled: waiverActions.postWaiverFulfilled
}
