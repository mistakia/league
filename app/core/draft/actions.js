export const draftActions = {
  LOAD_DRAFT: 'LOAD_DRAFT',

  DRAFT_SELECT_PLAYER: 'DRAFT_SELECT_PLAYER',
  DRAFT_PLAYER: 'DRAFT_PLAYER',

  DRAFTED_PLAYER: 'DRAFTED_PLAYER',

  GET_DRAFT_FAILED: 'GET_DRAFT_FAILED',
  GET_DRAFT_PENDING: 'GET_DRAFT_PENDING',
  GET_DRAFT_FULFILLED: 'GET_DRAFT_FULFILLED',

  POST_DRAFT_FAILED: 'POST_DRAFT_FAILED',
  POST_DRAFT_PENDING: 'POST_DRAFT_PENDING',
  POST_DRAFT_FULFILLED: 'POST_DRAFT_FULFILLED',

  selectPlayer: (pid) => ({
    type: draftActions.DRAFT_SELECT_PLAYER,
    payload: {
      pid
    }
  }),

  loadDraft: () => ({
    type: draftActions.LOAD_DRAFT
  }),

  draftPlayer: () => ({
    type: draftActions.DRAFT_PLAYER
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
  }),

  postDraftPending: (opts) => ({
    type: draftActions.POST_DRAFT_PENDING,
    payload: {
      opts
    }
  }),

  postDraftFailed: (opts, error) => ({
    type: draftActions.POST_DRAFT_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postDraftFulfilled: (opts, data) => ({
    type: draftActions.POST_DRAFT_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getDraftActions = {
  failed: draftActions.getDraftFailed,
  pending: draftActions.getDraftPending,
  fulfilled: draftActions.getDraftFulfilled
}

export const postDraftActions = {
  failed: draftActions.postDraftFailed,
  pending: draftActions.postDraftPending,
  fulfilled: draftActions.postDraftFulfilled
}
