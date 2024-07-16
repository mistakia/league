export const rosterActions = {
  PROJECT_LINEUPS: 'PROJECT_LINEUPS',

  EXPORT_ROSTERS: 'EXPORT_ROSTERS',
  LOAD_ROSTERS: 'LOAD_ROSTERS',

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

  ADD_TAG: 'ADD_TAG',
  REMOVE_TAG: 'REMOVE_TAG',

  NOMINATE_RESTRICTED_FREE_AGENT: 'NOMINATE_RESTRICTED_FREE_AGENT',
  UNNOMINATE_RESTRICTED_FREE_AGENT: 'UNNOMINATE_RESTRICTED_FREE_AGENT',

  ADD_TRANSITION_TAG: 'ADD_TRANSITION_TAG',
  REMOVE_TRANSITION_TAG: 'REMOVE_TRANSITION_TAG',
  UPDATE_TRANSITION_TAG: 'UPDATE_TRANSITION_TAG',

  POST_TAG_PENDING: 'POST_TAG_PENDING',
  POST_TAG_FAILED: 'POST_TAG_FAILED',
  POST_TAG_FULFILLED: 'POST_TAG_FULFILLED',

  DELETE_TAG_PENDING: 'DELETE_TAG_PENDING',
  DELETE_TAG_FAILED: 'DELETE_TAG_FAILED',
  DELETE_TAG_FULFILLED: 'DELETE_TAG_FULFILLED',

  POST_TRANSITION_TAG_PENDING: 'POST_TRANSITION_TAG_PENDING',
  POST_TRANSITION_TAG_FULFILLED: 'POST_TRANSITION_TAG_FULFILLED',
  POST_TRANSITION_TAG_FAILED: 'POST_TRANSITION_TAG_FAILED',

  DELETE_TRANSITION_TAG_PENDING: 'DELETE_TRANSITION_TAG_PENDING',
  DELETE_TRANSITION_TAG_FULFILLED: 'DELETE_TRANSITION_TAG_FULFILLED',
  DELETE_TRANSITION_TAG_FAILED: 'DELETE_TRANSITION_TAG_FAILED',

  PUT_TRANSITION_TAG_PENDING: 'PUT_TRANSITION_TAG_PENDING',
  PUT_TRANSITION_TAG_FULFILLED: 'PUT_TRANSITION_TAG_FULFILLED',
  PUT_TRANSITION_TAG_FAILED: 'PUT_TRANSITION_TAG_FAILED',

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

  POST_RESTRICTED_FREE_AGENT_NOMINATION_PENDING:
    'POST_RESTRICTED_FREE_AGENT_NOMINATION_PENDING',
  POST_RESTRICTED_FREE_AGENT_NOMINATION_FAILED:
    'POST_RESTRICTED_FREE_AGENT_NOMINATION_FAILED',
  POST_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED:
    'POST_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED',

  DELETE_RESTRICTED_FREE_AGENT_NOMINATION_PENDING:
    'DELETE_RESTRICTED_FREE_AGENT_NOMINATION_PENDING',
  DELETE_RESTRICTED_FREE_AGENT_NOMINATION_FAILED:
    'DELETE_RESTRICTED_FREE_AGENT_NOMINATION_FAILED',
  DELETE_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED:
    'DELETE_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED',

  loadRosters: (leagueId) => ({
    type: rosterActions.LOAD_ROSTERS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  exportRosters: () => ({
    type: rosterActions.EXPORT_ROSTERS
  }),

  addFreeAgent: ({ pid, release, slot }) => ({
    type: rosterActions.ADD_FREE_AGENT,
    payload: {
      pid,
      release,
      slot
    }
  }),

  release: (pid) => ({
    type: rosterActions.RELEASE_PLAYER,
    payload: {
      pid
    }
  }),

  reserve: ({ reserve_pid, slot, activate_pid }) => ({
    type: rosterActions.SET_ROSTER_RESERVE,
    payload: {
      reserve_pid,
      slot,
      activate_pid
    }
  }),

  // rookie, franchise tag
  addTag: ({ pid, tag, remove }) => ({
    type: rosterActions.ADD_TAG,
    payload: {
      pid,
      tag,
      remove
    }
  }),

  removeTag: ({ pid, teamId }) => ({
    type: rosterActions.REMOVE_TAG,
    payload: {
      pid,
      teamId
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

  activate: ({ activate_pid, release_pid, reserve_pid, slot }) => ({
    type: rosterActions.ACTIVATE_PLAYER,
    payload: {
      activate_pid,
      release_pid,
      reserve_pid,
      slot
    }
  }),

  deactivate: ({ deactivate_pid, release_pid }) => ({
    type: rosterActions.DEACTIVATE_PLAYER,
    payload: {
      deactivate_pid,
      release_pid
    }
  }),

  protect: (pid) => ({
    type: rosterActions.PROTECT_PLAYER,
    payload: {
      pid
    }
  }),

  update: (players) => ({
    type: rosterActions.UPDATE_ROSTER_PLAYER_SLOT,
    payload: {
      players
    }
  }),

  add: ({ pid, value, teamId }) => ({
    type: rosterActions.ADD_PLAYER_ROSTER,
    payload: {
      pid,
      value,
      teamId
    }
  }),

  remove: ({ pid, teamId }) => ({
    type: rosterActions.REMOVE_PLAYER_ROSTER,
    payload: {
      pid,
      teamId
    }
  }),

  nominate_restricted_free_agent: (pid) => ({
    type: rosterActions.NOMINATE_RESTRICTED_FREE_AGENT,
    payload: {
      pid
    }
  }),

  unnominate_restricted_free_agent: (pid) => ({
    type: rosterActions.UNNOMINATE_RESTRICTED_FREE_AGENT,
    payload: {
      pid
    }
  }),

  // TODO - currently not used
  // commish
  updateValue: ({ pid, value, teamId }) => ({
    type: rosterActions.UPDATE_PLAYER_ROSTER,
    payload: {
      pid,
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
  }),

  addTransitionTag: ({ pid, release, playerTid, teamId, bid, remove }) => ({
    type: rosterActions.ADD_TRANSITION_TAG,
    payload: {
      pid,
      release,
      teamId,
      playerTid,
      bid,
      remove
    }
  }),

  updateTransitionTag: ({ pid, release, playerTid, teamId, bid }) => ({
    type: rosterActions.UPDATE_TRANSITION_TAG,
    payload: {
      pid,
      release,
      teamId,
      playerTid,
      bid
    }
  }),

  removeTransitionTag: ({ pid, teamId }) => ({
    type: rosterActions.REMOVE_TRANSITION_TAG,
    payload: {
      pid,
      teamId
    }
  }),

  postTransitionTagFailed: (opts, error) => ({
    type: rosterActions.POST_TRANSITION_TAG_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postTransitionTagPending: (opts) => ({
    type: rosterActions.POST_TRANSITION_TAG_PENDING,
    payload: {
      opts
    }
  }),

  postTransitionTagFulfilled: (opts, data) => ({
    type: rosterActions.POST_TRANSITION_TAG_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  putTransitionTagFailed: (opts, error) => ({
    type: rosterActions.PUT_TRANSITION_TAG_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putTransitionTagPending: (opts) => ({
    type: rosterActions.PUT_TRANSITION_TAG_PENDING,
    payload: {
      opts
    }
  }),

  putTransitionTagFulfilled: (opts, data) => ({
    type: rosterActions.PUT_TRANSITION_TAG_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  deleteTagPending: (opts) => ({
    type: rosterActions.DELETE_TAG_PENDING,
    payload: {
      opts
    }
  }),

  deleteTagFulfilled: (opts, data) => ({
    type: rosterActions.DELETE_TAG_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  deleteTagFailed: (opts, error) => ({
    type: rosterActions.DELETE_TAG_FAILED,
    payload: {
      opts,
      error
    }
  }),

  deleteTransitionTagPending: (opts) => ({
    type: rosterActions.DELETE_TRANSITION_TAG_PENDING,
    payload: {
      opts
    }
  }),

  deleteTransitionTagFulfilled: (opts, data) => ({
    type: rosterActions.DELETE_TRANSITION_TAG_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  deleteTransitionTagFailed: (opts, error) => ({
    type: rosterActions.DELETE_TRANSITION_TAG_FAILED,
    payload: {
      opts,
      error
    }
  }),

  post_restricted_free_agent_nomination_pending: (opts) => ({
    type: rosterActions.POST_RESTRICTED_FREE_AGENT_NOMINATION_PENDING,
    payload: {
      opts
    }
  }),

  post_restricted_free_agent_nomination_failed: (opts, error) => ({
    type: rosterActions.POST_RESTRICTED_FREE_AGENT_NOMINATION_FAILED,
    payload: {
      opts,
      error
    }
  }),

  post_restricted_free_agent_nomination_fulfilled: (opts, data) => ({
    type: rosterActions.POST_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  delete_restricted_free_agent_nomination_pending: (opts) => ({
    type: rosterActions.DELETE_RESTRICTED_FREE_AGENT_NOMINATION_PENDING,
    payload: {
      opts
    }
  }),

  delete_restricted_free_agent_nomination_failed: (opts, error) => ({
    type: rosterActions.DELETE_RESTRICTED_FREE_AGENT_NOMINATION_FAILED,
    payload: {
      opts,
      error
    }
  }),

  delete_restricted_free_agent_nomination_fulfilled: (opts, data) => ({
    type: rosterActions.DELETE_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED,
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

export const deleteTagActions = {
  pending: rosterActions.deleteTagPending,
  failed: rosterActions.deleteTagFailed,
  fulfilled: rosterActions.deleteTagFulfilled
}

export const postTransitionTagActions = {
  pending: rosterActions.postTransitionTagPending,
  failed: rosterActions.postTransitionTagFailed,
  fulfilled: rosterActions.postTransitionTagFulfilled
}

export const putTransitionTagActions = {
  pending: rosterActions.putTransitionTagPending,
  failed: rosterActions.putTransitionTagFailed,
  fulfilled: rosterActions.putTransitionTagFulfilled
}

export const deleteTransitionTagActions = {
  pending: rosterActions.deleteTransitionTagPending,
  fulfilled: rosterActions.deleteTransitionTagFulfilled,
  failed: rosterActions.deleteTransitionTagFailed
}

export const post_restricted_free_agent_nomination_actions = {
  pending: rosterActions.post_restricted_free_agent_nomination_pending,
  failed: rosterActions.post_restricted_free_agent_nomination_failed,
  fulfilled: rosterActions.post_restricted_free_agent_nomination_fulfilled
}

export const delete_restricted_free_agent_nomination_actions = {
  pending: rosterActions.delete_restricted_free_agent_nomination_pending,
  failed: rosterActions.delete_restricted_free_agent_nomination_failed,
  fulfilled: rosterActions.delete_restricted_free_agent_nomination_fulfilled
}
