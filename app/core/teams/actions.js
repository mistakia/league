export const teamActions = {
  LOAD_TEAMS: 'LOAD_TEAMS',

  UPDATE_TEAM: 'UPDATE_TEAM',

  GET_TEAMS_FAILED: 'GET_TEAMS_FAILED',
  GET_TEAMS_PENDING: 'GET_TEAMS_PENDING',
  GET_TEAMS_FULFILLED: 'GET_TEAMS_FULFILLED',

  PUT_TEAM_FAILED: 'PUT_TEAM_FAILED',
  PUT_TEAM_PENDING: 'PUT_TEAM_PENDING',
  PUT_TEAM_FULFILLED: 'PUT_TEAM_FULFILLED',

  loadTeams: () => ({
    type: teamActions.LOAD_TEAMS
  }),

  update: ({ teamId, field, value }) => ({
    type: teamActions.UPDATE_TEAM,
    payload: {
      teamId,
      field,
      value
    }
  }),

  getTeamsFailed: (opts, error) => ({
    type: teamActions.GET_TEAMS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getTeamsFulfilled: (opts, data) => ({
    type: teamActions.GET_TEAMS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getTeamsPending: (opts) => ({
    type: teamActions.GET_TEAMS_PENDING,
    payload: {
      opts
    }
  }),

  putTeamFailed: (opts, error) => ({
    type: teamActions.PUT_TEAM_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putTeamPending: (opts) => ({
    type: teamActions.PUT_TEAM_PENDING,
    payload: {
      opts
    }
  }),

  putTeamFulfilled: (opts, data) => ({
    type: teamActions.PUT_TEAM_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getTeamsActions = {
  failed: teamActions.getTeamsFailed,
  pending: teamActions.getTeamsPending,
  fulfilled: teamActions.getTeamsFulfilled
}

export const putTeamActions = {
  failed: teamActions.putTeamFailed,
  pending: teamActions.putTeamPending,
  fulfilled: teamActions.putTeamFulfilled
}
