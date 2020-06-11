export const teamActions = {
  LOAD_TEAMS: 'LOAD_TEAMS',

  GET_TEAMS_FAILED: 'GET_TEAMS_FAILED',
  GET_TEAMS_PENDING: 'GET_TEAMS_PENDING',
  GET_TEAMS_FULFILLED: 'GET_TEAMS_FULFILLED',

  loadTeams: () => ({
    type: teamActions.LOAD_TEAMS
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
  })
}

export const getTeamsActions = {
  failed: teamActions.getTeamsFailed,
  pending: teamActions.getTeamsPending,
  fulfilled: teamActions.getTeamsFulfilled
}
