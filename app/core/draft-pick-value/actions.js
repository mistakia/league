export const draftPickValueActions = {
  LOAD_DRAFT_PICK_VALUE: 'LOAD_DRAFT_PICK_VALUE',

  GET_DRAFT_PICK_VALUE_FAILED: 'GET_DRAFT_PICK_VALUE_FAILED',
  GET_DRAFT_PICK_VALUE_FULFILLED: 'GET_DRAFT_PICK_VALUE_FULFILLED',
  GET_DRAFT_PICK_VALUE_PENDING: 'GET_DRAFT_PICK_VALUE_PENDING',

  loadDraftPickValue: () => ({
    type: draftPickValueActions.LOAD_DRAFT_PICK_VALUE
  }),

  getDraftPickValuePending: (opts) => ({
    type: draftPickValueActions.GET_DRAFT_PICK_VALUE_PENDING,
    payload: {
      opts
    }
  }),

  getDraftPickValueFulfilled: (opts, data) => ({
    type: draftPickValueActions.GET_DRAFT_PICK_VALUE_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getDraftPickValueFailed: (opts, error) => ({
    type: draftPickValueActions.GET_DRAFT_PICK_VALUE_FAILED,
    payload: {
      opts,
      error
    }
  })
}

export const getDraftPickValueActions = {
  failed: draftPickValueActions.getDraftPickValueFailed,
  pending: draftPickValueActions.getDraftPickValuePending,
  fulfilled: draftPickValueActions.getDraftPickValueFulfilled
}
