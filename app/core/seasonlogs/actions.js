export const seasonlogsActions = {
  GET_NFL_TEAM_SEASONLOGS_FAILED: 'GET_NFL_TEAM_SEASONLOGS_FAILED',
  GET_NFL_TEAM_SEASONLOGS_PENDING: 'GET_NFL_TEAM_SEASONLOGS_PENDING',
  GET_NFL_TEAM_SEASONLOGS_FULFILLED: 'GET_NFL_TEAM_SEASONLOGS_FULFILLED',

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
