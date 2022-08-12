export const teamActions = {
  LOAD_TEAMS: 'LOAD_TEAMS',

  UPDATE_TEAM: 'UPDATE_TEAM',

  ADD_TEAM: 'ADD_TEAM',
  DELETE_TEAM: 'DELETE_TEAM',

  LOAD_LEAGUE_TEAM_STATS: 'LOAD_LEAGUE_TEAM_STATS',

  GET_TEAMS_FAILED: 'GET_TEAMS_FAILED',
  GET_TEAMS_PENDING: 'GET_TEAMS_PENDING',
  GET_TEAMS_FULFILLED: 'GET_TEAMS_FULFILLED',

  PUT_TEAM_FAILED: 'PUT_TEAM_FAILED',
  PUT_TEAM_PENDING: 'PUT_TEAM_PENDING',
  PUT_TEAM_FULFILLED: 'PUT_TEAM_FULFILLED',

  POST_TEAMS_FAILED: 'POST_TEAMS_FAILED',
  POST_TEAMS_PENDING: 'POST_TEAMS_PENDING',
  POST_TEAMS_FULFILLED: 'POST_TEAMS_FULFILLED',

  DELETE_TEAMS_PENDING: 'DELETE_TEAMS_PENDING',
  DELETE_TEAMS_FAILED: 'DELETE_TEAMS_FAILED',
  DELETE_TEAMS_FULFILLED: 'DELETE_TEAMS_FULFILLED',

  GET_LEAGUE_TEAM_STATS_FAILED: 'GET_LEAGUE_TEAM_STATS_FAILED',
  GET_LEAGUE_TEAM_STATS_PENDING: 'GET_LEAGUE_TEAM_STATS_PENDING',
  GET_LEAGUE_TEAM_STATS_FULFILLED: 'GET_LEAGUE_TEAM_STATS_FULFILLED',

  loadTeams: (leagueId) => ({
    type: teamActions.LOAD_TEAMS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  loadLeagueTeamStats: (leagueId) => ({
    type: teamActions.LOAD_LEAGUE_TEAM_STATS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  add: () => ({
    type: teamActions.ADD_TEAM
  }),

  delete: (teamId) => ({
    type: teamActions.DELETE_TEAM,
    payload: {
      teamId
    }
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
  }),

  postTeamsFailed: (opts, error) => ({
    type: teamActions.POST_TEAMS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postTeamsPending: (opts) => ({
    type: teamActions.POST_TEAMS_PENDING,
    payload: {
      opts
    }
  }),

  postTeamsFulfilled: (opts, data) => ({
    type: teamActions.POST_TEAMS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  deleteTeamsPending: (opts) => ({
    type: teamActions.DELETE_TEAMS_PENDING,
    payload: {
      opts
    }
  }),

  deleteTeamsFailed: (opts, error) => ({
    type: teamActions.DELETE_TEAMS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  deleteTeamsFulfilled: (opts, data) => ({
    type: teamActions.DELETE_TEAMS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getLeagueTeamStatsFailed: (opts, error) => ({
    type: teamActions.GET_LEAGUE_TEAM_STATS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getLeagueTeamStatsPending: (opts) => ({
    type: teamActions.GET_LEAGUE_TEAM_STATS_PENDING,
    payload: {
      opts
    }
  }),

  getLeagueTeamStatsFulfilled: (opts, data) => ({
    type: teamActions.GET_LEAGUE_TEAM_STATS_FULFILLED,
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

export const postTeamsActions = {
  failed: teamActions.postTeamsFailed,
  pending: teamActions.postTeamsPending,
  fulfilled: teamActions.postTeamsFulfilled
}

export const deleteTeamsActions = {
  failed: teamActions.deleteTeamsFailed,
  pending: teamActions.deleteTeamsPending,
  fulfilled: teamActions.deleteTeamsFulfilled
}

export const getLeagueTeamStatsActions = {
  failed: teamActions.getLeagueTeamStatsFailed,
  pending: teamActions.getLeagueTeamStatsPending,
  fulfilled: teamActions.getLeagueTeamStatsFulfilled
}
