export const waiverActions = {
  WAIVER_CLAIM: 'WAIVER_CLAIM',

  CANCEL_CLAIM: 'CANCEL_CLAIM',

  REORDER_POACH: 'REORDER_POACH',

  POST_WAIVER_FAILED: 'POST_WAIVER_FAILED',
  POST_WAIVER_FULFILLED: 'POST_WAIVER_FULFILLED',
  POST_WAIVER_PENDING: 'POST_WAIVER_PENDING',

  POST_CANCEL_WAIVER_FAILED: 'POST_CANCEL_WAIVER_FAILED',
  POST_CANCEL_WAIVER_FULFILLED: 'POST_CANCEL_WAIVER_FULFILLED',
  POST_CANCEL_WAIVER_PENDING: 'POST_CANCEL_WAIVER_PENDING',

  POST_WAIVER_ORDER_FAILED: 'POST_WAIVER_ORDER_FAILED',
  POST_WAIVER_ORDER_PENDING: 'POST_WAIVER_ORDER_PENDING',
  POST_WAIVER_ORDER_FULFILLED: 'POST_WAIVER_ORDER_FULFILLED',

  reorderPoach: ({ oldIndex, newIndex }) => ({
    type: waiverActions.REORDER_POACH,
    payload: {
      oldIndex,
      newIndex
    }
  }),

  claim: ({ player, bid, drop, type }) => ({
    type: waiverActions.WAIVER_CLAIM,
    payload: {
      player,
      bid,
      drop,
      type
    }
  }),

  cancel: (waiverId) => ({
    type: waiverActions.CANCEL_CLAIM,
    payload: {
      waiverId
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
  }),

  postCancelWaiverPending: opts => ({
    type: waiverActions.POST_CANCEL_WAIVER_PENDING,
    payload: {
      opts
    }
  }),

  postCancelWaiverFulfilled: (opts, data) => ({
    type: waiverActions.POST_CANCEL_WAIVER_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postCancelWaiverFailed: (opts, error) => ({
    type: waiverActions.POST_CANCEL_WAIVER_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postWaiverOrderPending: opts => ({
    type: waiverActions.POST_WAIVER_ORDER_PENDING,
    payload: {
      opts
    }
  }),

  postWaiverOrderFailed: (opts, error) => ({
    type: waiverActions.POST_WAIVER_ORDER_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postWaiverOrderFulfilled: (opts, data) => ({
    type: waiverActions.POST_WAIVER_ORDER_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const postWaiverActions = {
  failed: waiverActions.postWaiverFailed,
  pending: waiverActions.postWaiverPending,
  fulfilled: waiverActions.postWaiverFulfilled
}

export const postCancelWaiverActions = {
  failed: waiverActions.postCancelWaiverFailed,
  pending: waiverActions.postCancelWaiverPending,
  fulfilled: waiverActions.postCancelWaiverFulfilled
}

export const postWaiverOrderActions = {
  failed: waiverActions.postWaiverOrderFailed,
  pending: waiverActions.postWaiverOrderPending,
  fulfilled: waiverActions.postWaiverOrderFulfilled
}
