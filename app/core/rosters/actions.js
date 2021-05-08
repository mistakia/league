export const rosterActions = {
  PROJECT_LINEUPS: 'PROJECT_LINEUPS',

  // USER
  SET_LINEUPS: 'SET_LINEUPS',
  SET_ROSTER_RESERVE: 'SET_ROSTER_RESERVE',
  UPDATE_ROSTER_PLAYER_SLOT: 'UPDATE_ROSTER_PLAYER_SLOT',
  ADD_FREE_AGENT: 'ADD_FREE_AGENT',
  RELEASE_PLAYER: 'RELEASE_PLAYER',

  // COMMISH / ADMIN
  ADD_PLAYER_ROSTER: 'ADD_PLAYER_ROSTER',
  REMOVE_PLAYER_ROSTER: 'REMOVE_PLAYER_ROSTER',
  UPDATE_PLAYER_ROSTER: 'UPDATE_PLAYER_ROSTER',

  // Websocket Events
  ROSTER_TRANSACTION: 'ROSTER_TRANSACTION',
  ROSTER_TRANSACTIONS: 'ROSTER_TRANSACTIONS',

  ACTIVATE_PLAYER: 'ACTIVATE_PLAYER',
  DEACTIVATE_PLAYER: 'DEACTIVATE_PLAYER',
  PROTECT_PLAYER: 'PROTECT_PLAYER',
  TAG_PLAYER: 'TAG_PLAYER',

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

  POST_PROTECT_FAILED: 'POST_PROTECT_FAILED',
  POST_PROTECT_PENDING: 'POST_PROTECT_PENDING',
  POST_PROTECT_FULFILLED: 'POST_PROTECT_FULFILLED',

  POST_ROSTERS_FAILED: 'POST_ROSTERS_FAILED',
  POST_ROSTERS_PENDING: 'POST_ROSTERS_PENDING',
  POST_ROSTERS_FULFILLED: 'POST_ROSTERS_FULFILLED',

  DELETE_ROSTERS_FAILED: 'DELETE_ROSTERS_FAILED',
  DELETE_ROSTERS_PENDING: 'DELETE_ROSTERS_PENDING',
  DELETE_ROSTERS_FULFILLED: 'DELETE_ROSTERS_FULFILLED',

  PUT_ROSTERS_FAILED: 'PUT_ROSTERS_FAILED',
  PUT_ROSTERS_PENDING: 'PUT_ROSTERS_PENDING',
  PUT_ROSTERS_FULFILLED: 'PUT_ROSTERS_FULFILLED',

  POST_ADD_FREE_AGENT_FAILED: 'POST_ADD_FREE_AGENT_FAILED',
  POST_ADD_FREE_AGENT_PENDING: 'POST_ADD_FREE_AGENT_PENDING',
  POST_ADD_FREE_AGENT_FULFILLED: 'POST_ADD_FREE_AGENT_FULFILLED',

  POST_RESERVE_PENDING: 'POST_RESERVE_PENDING',
  POST_RESERVE_FAILED: 'POST_RESERVE_FAILED',
  POST_RESERVE_FULFILLED: 'POST_RESERVE_FULFILLED',

  POST_RELEASE_PENDING: 'POST_RELEASE_PENDING',
  POST_RELEASE_FAILED: 'POST_RELEASE_FAILED',
  POST_RELEASE_FULFILLED: 'POST_RELEASE_FULFILLED',

  POST_TAG_PENDING: 'POST_TAG_PENDING',
  POST_TAG_FAILED: 'POST_TAG_FAILED',
  POST_TAG_FULFILLED: 'POST_TAG_FULFILLED',

  addFreeAgent: ({ player, drop, slot }) => ({
    type: rosterActions.ADD_FREE_AGENT,
    payload: {
      player,
      drop,
      slot
    }
  }),

  release: (player) => ({
    type: rosterActions.RELEASE_PLAYER,
    payload: {
      player
    }
  }),

  reserve: ({ player, slot }) => ({
    type: rosterActions.SET_ROSTER_RESERVE,
    payload: {
      player,
      slot
    }
  }),

  // rookie, franchise tag
  tag: ({ player, tag, remove }) => ({
    type: rosterActions.TAG_PLAYER,
    payload: {
      player,
      tag,
      remove
    }
  }),

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

  protect: (player) => ({
    type: rosterActions.PROTECT_PLAYER,
    payload: {
      player
    }
  }),

  update: (players) => ({
    type: rosterActions.UPDATE_ROSTER_PLAYER_SLOT,
    payload: {
      players
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

  // commish
  updateValue: ({ player, value, teamId }) => ({
    type: rosterActions.UPDATE_PLAYER_ROSTER,
    payload: {
      player,
      teamId
    }
  }),

  getRostersPending: (opts) => ({
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

  putRosterPending: (opts) => ({
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

  postProtectPending: (opts) => ({
    type: rosterActions.POST_PROTECT_PENDING,
    payload: {
      opts
    }
  }),

  postProtectFulfilled: (opts, data) => ({
    type: rosterActions.POST_PROTECT_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postProtectFailed: (opts, error) => ({
    type: rosterActions.POST_PROTECT_FAILED,
    payload: {
      opts,
      error
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

  putRostersPending: (opts) => ({
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

  postRostersPending: (opts) => ({
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

  deleteRostersPending: (opts) => ({
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
  }),

  postAddFreeAgentPending: (opts) => ({
    type: rosterActions.POST_ADD_FREE_AGENT_PENDING,
    payload: {
      opts
    }
  }),

  postAddFreeAgentFailed: (opts, error) => ({
    type: rosterActions.POST_ADD_FREE_AGENT_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postAddFreeAgentFulfilled: (opts, data) => ({
    type: rosterActions.POST_ADD_FREE_AGENT_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postReservePending: (opts) => ({
    type: rosterActions.POST_RESERVE_PENDING,
    payload: {
      opts
    }
  }),

  postReserveFailed: (opts, error) => ({
    type: rosterActions.POST_RESERVE_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postReserveFulfilled: (opts, data) => ({
    type: rosterActions.POST_RESERVE_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postReleasePending: (opts) => ({
    type: rosterActions.POST_RELEASE_PENDING,
    payload: {
      opts
    }
  }),

  postReleaseFailed: (opts, error) => ({
    type: rosterActions.POST_RELEASE_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postReleaseFulfilled: (opts, data) => ({
    type: rosterActions.POST_RELEASE_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postTagPending: (opts) => ({
    type: rosterActions.POST_TAG_PENDING,
    payload: {
      opts
    }
  }),

  postTagFailed: (opts, error) => ({
    type: rosterActions.POST_TAG_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postTagFulfilled: (opts, data) => ({
    type: rosterActions.POST_TAG_FULFILLED,
    payload: {
      opts,
      data
    }
  })
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

export const postProtectActions = {
  failed: rosterActions.postProtectFailed,
  pending: rosterActions.postProtectPending,
  fulfilled: rosterActions.postProtectFulfilled
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

export const postAddFreeAgentActions = {
  failed: rosterActions.postAddFreeAgentFailed,
  pending: rosterActions.postAddFreeAgentPending,
  fulfilled: rosterActions.postAddFreeAgentFulfilled
}

export const postReserveActions = {
  pending: rosterActions.postReservePending,
  failed: rosterActions.postReserveFailed,
  fulfilled: rosterActions.postReserveFulfilled
}

export const postReleaseActions = {
  pending: rosterActions.postReleasePending,
  failed: rosterActions.postReleaseFailed,
  fulfilled: rosterActions.postReleaseFulfilled
}

export const postTagActions = {
  pending: rosterActions.postTagPending,
  failed: rosterActions.postTagFailed,
  fulfilled: rosterActions.postTagFulfilled
}
