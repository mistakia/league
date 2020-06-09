export const rosterActions = {
  LOAD_ROSTER: 'LOAD_ROSTER',

  GET_ROSTER_FAILED: 'GET_ROSTER_FAILED',
  GET_ROSTER_PENDING: 'GET_ROSTER_PENDING',
  GET_ROSTER_FULFILLED: 'GET_ROSTER_FULFILLED',

  loadRoster: (teamId) => ({
    type: rosterActions.LOAD_ROSTER,
    payload: {
      teamId
    }
  }),

  getRosterFailed: (opts, error) => ({
    type: rosterActions.GET_ROSTER_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getRosterFulfilled: (opts, data) => ({
    type: rosterActions.GET_ROSTER_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getRosterPending: opts => ({
    type: rosterActions.GET_ROSTER_PENDING,
    payload: {
      opts
    }
  })
}

export const getRosterActions = {
  failed: rosterActions.getRosterFailed,
  pending: rosterActions.getRosterPending,
  fulfilled: rosterActions.getRosterFulfilled
}
