export const rosterActions = {
  LOAD_ROSTER: 'LOAD_ROSTER',
  LOAD_ROSTERS: 'LOAD_ROSTERS',

  ROSTER_DEACTIVATION: 'ROSTER_DEACTIVATION',
  ROSTER_ACTIVATION: 'ROSTER_ACTIVATION',

  UPDATE_ROSTER: 'UPDATE_ROSTER',

  ROSTER_TRANSACTIONS: 'ROSTER_TRANSACTIONS',

  ACTIVATE_PLAYER: 'ACTIVATE_PLAYER',
  DEACTIVATE_PLAYER: 'DEACTIVATE_PLAYER',

  GET_ROSTER_FAILED: 'GET_ROSTER_FAILED',
  GET_ROSTER_PENDING: 'GET_ROSTER_PENDING',
  GET_ROSTER_FULFILLED: 'GET_ROSTER_FULFILLED',

  GET_ROSTERS_FAILED: 'GET_ROSTERS_FAILED',
  GET_ROSTERS_PENDING: 'GET_ROSTERS_PENDING',
  GET_ROSTERS_FULFILLED: 'GET_ROSTERS_FULFILLED',

  PUT_ROSTER_FAILED: 'PUT_ROSTER_FAILED',
  PUT_ROSTER_PENDING: 'PUT_ROSTER_PENDING',
  PUT_ROSTER_FULFILLED: 'PUT_ROSTER_FULFILLED',

  POST_ACTIVATE_FAILED: 'POST_ACTIVATE_FAILED',
  POST_ACTIVATE_PENDING: 'POST_ACTIVATE_PENDING',
  POST_ACTIVATE_FULFILLED: 'POST_ACTIVATE_FULFILLED',

  POST_DEACTIVATE_FAILED: 'POST_DEACTIVATE_FAILED',
  POST_DEACTIVATE_PENDING: 'POST_DEACTIVATE_PENDING',
  POST_DEACTIVATE_FULFILLED: 'POST_DEACTIVATE_FULFILLED',

  activate: (player) => ({
    type: rosterActions.ACTIVATE_PLAYER,
    payload: {
      player
    }
  }),

  deactivate: (player) => ({
    type: rosterActions.DEACTIVATE_PLAYER,
    payload: {
      player
    }
  }),

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
  }),

  postActivatePending: (opts) => ({
    type: rosterActions.POST_ACTIVATE_PENDING,
    payload: {
      opts
    }
  }),

  postActivateFailed: (opts, error) => ({
    type: rosterActions.POST_ACTIVATE_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postActivateFulfilled: (opts, data) => ({
    type: rosterActions.POST_ACTIVATE_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postDeactivatePending: (opts) => ({
    type: rosterActions.POST_DEACTIVATE_PENDING,
    payload: {
      opts
    }
  }),

  postDeactivateFulfilled: (opts, data) => ({
    type: rosterActions.POST_DEACTIVATE_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postDeactivateFailed: (opts, error) => ({
    type: rosterActions.POST_DEACTIVATE_FAILED,
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

export const postActivateActions = {
  failed: rosterActions.postActivateFailed,
  pending: rosterActions.postActivatePending,
  fulfilled: rosterActions.postActivateFulfilled
}

export const postDeactivateActions = {
  failed: rosterActions.postDeactivateFailed,
  pending: rosterActions.postDeactivatePending,
  fulfilled: rosterActions.postDeactivateFulfilled
}
