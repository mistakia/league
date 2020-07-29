export const rosterActions = {
  LOAD_ROSTER: 'LOAD_ROSTER',
  LOAD_ROSTERS: 'LOAD_ROSTERS',

  UPDATE_ROSTER: 'UPDATE_ROSTER',

  GET_ROSTER_FAILED: 'GET_ROSTER_FAILED',
  GET_ROSTER_PENDING: 'GET_ROSTER_PENDING',
  GET_ROSTER_FULFILLED: 'GET_ROSTER_FULFILLED',

  GET_ROSTERS_FAILED: 'GET_ROSTERS_FAILED',
  GET_ROSTERS_PENDING: 'GET_ROSTERS_PENDING',
  GET_ROSTERS_FULFILLED: 'GET_ROSTERS_FULFILLED',

  PUT_ROSTER_FAILED: 'PUT_ROSTER_FAILED',
  PUT_ROSTER_PENDING: 'PUT_ROSTER_PENDING',
  PUT_ROSTER_FULFILLED: 'PUT_ROSTER_FULFILLED',

  update: ({ slot, player }) => ({
    type: rosterActions.UPDATE_ROSTER,
    payload: {
      slot,
      player
    }
  }),

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
  }),

  putRosterPending: opts => ({
    type: rosterActions.PUT_ROSTER_PENDING,
    payload: {
      opts
    }
  }),

  putRosterFulfilled: (opts, data) => ({
    type: rosterActions.PUT_ROSTER_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  putRosterFailed: (opts, error) => ({
    type: rosterActions.PUT_ROSTER_FAILED,
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

export const putRosterActions = {
  failed: rosterActions.putRosterFailed,
  pending: rosterActions.putRosterPending,
  fulfilled: rosterActions.putRosterFulfilled
}
