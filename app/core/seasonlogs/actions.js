export const seasonlogsActions = {
  LOAD_NFL_TEAM_SEASONLOGS: 'LOAD_NFL_TEAM_SEASONLOGS',

  GET_NFL_TEAM_SEASONLOGS_FAILED: 'GET_NFL_TEAM_SEASONLOGS_FAILED',
  GET_NFL_TEAM_SEASONLOGS_PENDING: 'GET_NFL_TEAM_SEASONLOGS_PENDING',
  GET_NFL_TEAM_SEASONLOGS_FULFILLED: 'GET_NFL_TEAM_SEASONLOGS_FULFILLED',

  load_nfl_team_seasonlogs: () => ({
    type: seasonlogsActions.LOAD_NFL_TEAM_SEASONLOGS
  }),

  getNflTeamSeasonlogsFailed: (opts, error) => ({
    type: seasonlogsActions.GET_NFL_TEAM_SEASONLOGS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getNflTeamSeasonlogsPending: (opts) => ({
    type: seasonlogsActions.GET_NFL_TEAM_SEASONLOGS_PENDING,
    payload: {
      opts
    }
  }),

  getNflTeamSeasonlogsFulfilled: (opts, data) => ({
    type: seasonlogsActions.GET_NFL_TEAM_SEASONLOGS_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getNflTeamSeasonlogsActions = {
  failed: seasonlogsActions.getNflTeamSeasonlogsFailed,
  pending: seasonlogsActions.getNflTeamSeasonlogsPending,
  fulfilled: seasonlogsActions.getNflTeamSeasonlogsFulfilled
}
