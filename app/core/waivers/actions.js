export const waiverActions = {
  LOAD_WAIVERS: 'LOAD_WAIVERS',
  WAIVER_CLAIM: 'WAIVER_CLAIM',
  FILTER_WAIVERS: 'FILTER_WAIVERS',

  CANCEL_CLAIM: 'CANCEL_CLAIM',
  UPDATE_WAIVER_CLAIM: 'UPDATE_WAIVER_CLAIM',

  REORDER_WAIVERS: 'REORDER_WAIVERS',

  POST_WAIVER_FAILED: 'POST_WAIVER_FAILED',
  POST_WAIVER_FULFILLED: 'POST_WAIVER_FULFILLED',
  POST_WAIVER_PENDING: 'POST_WAIVER_PENDING',

  PUT_WAIVER_FAILED: 'PUT_WAIVER_FAILED',
  PUT_WAIVER_PENDING: 'PUT_WAIVER_PENDING',
  PUT_WAIVER_FULFILLED: 'PUT_WAIVER_FULFILLED',

  POST_CANCEL_WAIVER_FAILED: 'POST_CANCEL_WAIVER_FAILED',
  POST_CANCEL_WAIVER_FULFILLED: 'POST_CANCEL_WAIVER_FULFILLED',
  POST_CANCEL_WAIVER_PENDING: 'POST_CANCEL_WAIVER_PENDING',

  POST_WAIVER_ORDER_FAILED: 'POST_WAIVER_ORDER_FAILED',
  POST_WAIVER_ORDER_PENDING: 'POST_WAIVER_ORDER_PENDING',
  POST_WAIVER_ORDER_FULFILLED: 'POST_WAIVER_ORDER_FULFILLED',

  GET_WAIVERS_PENDING: 'GET_WAIVERS_PENDING',
  GET_WAIVERS_FAILED: 'GET_WAIVERS_FAILED',
  GET_WAIVERS_FULFILLED: 'GET_WAIVERS_FULFILLED',

  GET_WAIVER_REPORT_PENDING: 'GET_WAIVER_REPORT_PENDING',
  GET_WAIVER_REPORT_FAILED: 'GET_WAIVER_REPORT_FAILED',
  GET_WAIVER_REPORT_FULFILLED: 'GET_WAIVER_REPORT_FULFILLED',

  filter: ({ type, values }) => ({
    type: waiverActions.FILTER_WAIVERS,
    payload: {
      type,
      values
    }
  }),

  loadWaivers: (leagueId) => ({
    type: waiverActions.LOAD_WAIVERS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  reorderWaivers: ({ oldIndex, newIndex, type }) => ({
    type: waiverActions.REORDER_WAIVERS,
    payload: {
      oldIndex,
      newIndex,
      type
    }
  }),

  claim: ({ pid, bid, release, type }) => ({
    type: waiverActions.WAIVER_CLAIM,
    payload: {
      pid,
      bid,
      release,
      type
    }
  }),

  update: ({ waiverId, release, bid }) => ({
    type: waiverActions.UPDATE_WAIVER_CLAIM,
    payload: {
      waiverId,
      release,
      bid
    }
  }),

  cancel: (waiverId) => ({
    type: waiverActions.CANCEL_CLAIM,
    payload: {
      waiverId
    }
  }),

  postWaiverPending: (opts) => ({
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

  putWaiverPending: (opts) => ({
    type: waiverActions.PUT_WAIVER_PENDING,
    payload: {
      opts
    }
  }),

  putWaiverFailed: (opts, error) => ({
    type: waiverActions.PUT_WAIVER_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putWaiverFulfilled: (opts, data) => ({
    type: waiverActions.PUT_WAIVER_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postCancelWaiverPending: (opts) => ({
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

  postWaiverOrderPending: (opts) => ({
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
  }),

  getWaiversPending: (opts) => ({
    type: waiverActions.GET_WAIVERS_PENDING,
    payload: {
      opts
    }
  }),

  getWaiversFailed: (opts, error) => ({
    type: waiverActions.GET_WAIVERS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getWaiversFulfilled: (opts, data) => ({
    type: waiverActions.GET_WAIVERS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getWaiverReportPending: (opts) => ({
    type: waiverActions.GET_WAIVER_REPORT_PENDING,
    payload: {
      opts
    }
  }),

  getWaiverReportFailed: (opts, error) => ({
    type: waiverActions.GET_WAIVER_REPORT_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getWaiverReportFulfilled: (opts, data) => ({
    type: waiverActions.GET_WAIVER_REPORT_FULFILLED,
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

export const putWaiverActions = {
  pending: waiverActions.putWaiverPending,
  failed: waiverActions.putWaiverFailed,
  fulfilled: waiverActions.putWaiverFulfilled
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

export const getWaiversActions = {
  pending: waiverActions.getWaiversPending,
  failed: waiverActions.getWaiversFailed,
  fulfilled: waiverActions.getWaiversFulfilled
}

export const getWaiverReportActions = {
  pending: waiverActions.getWaiverReportPending,
  failed: waiverActions.getWaiverReportFailed,
  fulfilled: waiverActions.getWaiverReportFulfilled
}
