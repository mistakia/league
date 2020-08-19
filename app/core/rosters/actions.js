export const rosterActions = {
  LOAD_ROSTER: 'LOAD_ROSTER',
  LOAD_ROSTERS: 'LOAD_ROSTERS',

  PROJECT_LINEUPS: 'PROJECT_LINEUPS',
  SET_LINEUPS: 'SET_LINEUPS',

  ROSTER_DEACTIVATION: 'ROSTER_DEACTIVATION',
  ROSTER_ACTIVATION: 'ROSTER_ACTIVATION',

  UPDATE_ROSTER: 'UPDATE_ROSTER',
  ADD_PLAYER_ROSTER: 'ADD_PLAYER_ROSTER',
  REMOVE_PLAYER_ROSTER: 'REMOVE_PLAYER_ROSTER',
  UPDATE_PLAYER_ROSTER: 'UPDATE_PLAYER_ROSTER',

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

  POST_ROSTERS_FAILED: 'POST_ROSTERS_FAILED',
  POST_ROSTERS_PENDING: 'POST_ROSTERS_PENDING',
  POST_ROSTERS_FULFILLED: 'POST_ROSTERS_FULFILLED',

  DELETE_ROSTERS_FAILED: 'DELETE_ROSTERS_FAILED',
  DELETE_ROSTERS_PENDING: 'DELETE_ROSTERS_PENDING',
  DELETE_ROSTERS_FULFILLED: 'DELETE_ROSTERS_FULFILLED',

  PUT_ROSTERS_FAILED: 'PUT_ROSTERS_FAILED',
  PUT_ROSTERS_PENDING: 'PUT_ROSTERS_PENDING',
  PUT_ROSTERS_FULFILLED: 'PUT_ROSTERS_FULFILLED',

  projectLineups: () => ({
    type: rosterActions.PROJECT_LINEUPS
  }),

  setLineupProjections: (lineups) => ({
    type: rosterActions.SET_LINEUPS,
    payload: {
      lineups
    }
  }),

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

  add: ({ player, value, teamId }) => ({
    type: rosterActions.ADD_PLAYER_ROSTER,
    payload: {
      player,
      value,
      teamId
    }
  }),

  remove: ({ player, teamId }) => ({
    type: rosterActions.REMOVE_PLAYER_ROSTER,
    payload: {
      player,
      teamId
    }
  }),

  updateValue: ({ player, value, teamId }) => ({
    type: rosterActions.UPDATE_PLAYER_ROSTER,
    payload: {
      player,
      teamId
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
  }),

  putRostersPending: opts => ({
    type: rosterActions.PUT_ROSTERS_PENDING,
    payload: {
      opts
    }
  }),

  putRostersFailed: (opts, error) => ({
    type: rosterActions.PUT_ROSTERS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putRostersFulfilled: (opts, data) => ({
    type: rosterActions.PUT_ROSTERS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postRostersPending: opts => ({
    type: rosterActions.POST_ROSTERS_PENDING,
    payload: {
      opts
    }
  }),

  postRostersFulfilled: (opts, data) => ({
    type: rosterActions.POST_ROSTERS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postRostersFailed: (opts, error) => ({
    type: rosterActions.POST_ROSTERS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  deleteRostersPending: opts => ({
    type: rosterActions.DELETE_ROSTERS_PENDING,
    payload: {
      opts
    }
  }),

  deleteRostersFailed: (opts, error) => ({
    type: rosterActions.DELETE_ROSTERS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  deleteRostersFulfilled: (opts, data) => ({
    type: rosterActions.DELETE_ROSTERS_FULFILLED,
    payload: {
      opts,
      data
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

export const putRostersActions = {
  failed: rosterActions.putRostersFailed,
  pending: rosterActions.putRostersPending,
  fulfilled: rosterActions.putRostersFulfilled
}

export const postRostersActions = {
  failed: rosterActions.postRostersFailed,
  pending: rosterActions.postRostersPending,
  fulfilled: rosterActions.postRostersFulfilled
}

export const deleteRostersActions = {
  failed: rosterActions.deleteRostersFailed,
  pending: rosterActions.deleteRostersPending,
  fulfilled: rosterActions.deleteRostersFulfilled
}
