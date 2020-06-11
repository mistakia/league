export const draftActions = {
  LOAD_DRAFT: 'LOAD_DRAFT',

  GET_DRAFT_FAILED: 'GET_DRAFT_FAILED',
  GET_DRAFT_PENDING: 'GET_DRAFT_PENDING',
  GET_DRAFT_FULFILLED: 'GET_DRAFT_FULFILLED',

  loadDraft: () => ({
    type: draftActions.LOAD_DRAFT
  }),

  getDraftFailed: (opts, error) => ({
    type: draftActions.GET_DRAFT_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getDraftFulfilled: (opts, data) => ({
    type: draftActions.GET_DRAFT_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getDraftPending: (opts) => ({
    type: draftActions.GET_DRAFT_PENDING,
    payload: {
      opts
    }
  })
}

export const getDraftActions = {
  failed: draftActions.getDraftFailed,
  pending: draftActions.getDraftPending,
  fulfilled: draftActions.getDraftFulfilled
}
