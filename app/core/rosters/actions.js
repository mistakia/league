export const rosterActions = {
  LOAD_ROSTER: 'LOAD_ROSTER',
  LOAD_ROSTERS: 'LOAD_ROSTERS',

  ROSTER_SLOT_UPDATED: 'ROSTER_SLOT_UPDATED',

  GET_ROSTER_FAILED: 'GET_ROSTER_FAILED',
  GET_ROSTER_PENDING: 'GET_ROSTER_PENDING',
  GET_ROSTER_FULFILLED: 'GET_ROSTER_FULFILLED',

  GET_ROSTERS_FAILED: 'GET_ROSTERS_FAILED',
  GET_ROSTERS_PENDING: 'GET_ROSTERS_PENDING',
  GET_ROSTERS_FULFILLED: 'GET_ROSTERS_FULFILLED',

  loadRoster: (teamId) => ({
    type: rosterActions.LOAD_ROSTER,
    payload: {
      teamId
    }
  }),

  loadRosters: () => ({
    type: rosterActions.LOAD_ROSTERS
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
  }),

  getRostersPending: opts => ({
    type: rosterActions.GET_ROSTERS_PENDING,
    payload: {
      opts
    }
  }),

  getRostersFulfilled: (opts, data) => ({
    type: rosterActions.GET_ROSTERS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getRostersFailed: (opts, error) => ({
    type: rosterActions.GET_ROSTERS_FAILED,
    payload: {
      opts,
      error
    }
  })
}

export const getRosterActions = {
  failed: rosterActions.getRosterFailed,
  pending: rosterActions.getRosterPending,
  fulfilled: rosterActions.getRosterFulfilled
}

export const getRostersActions = {
  failed: rosterActions.getRostersFailed,
  pending: rosterActions.getRostersPending,
  fulfilled: rosterActions.getRostersFulfilled
}
