export const leagueActions = {
  UPDATE_LEAGUE: 'UPDATE_LEAGUE',

  SET_LEAGUE: 'SET_LEAGUE',

  PUT_LEAGUE_FAILED: 'PUT_LEAGUE_FAILED',
  PUT_LEAGUE_PENDING: 'PUT_LEAGUE_PENDING',
  PUT_LEAGUE_FULFILLED: 'PUT_LEAGUE_FULFILLED',

  update: ({ leagueId, value, field }) => ({
    type: leagueActions.UPDATE_LEAGUE,
    payload: {
      leagueId,
      value,
      field
    }
  }),

  set: (opts) => ({
    type: leagueActions.SET_LEAGUE,
    payload: {
      opts
    }
  }),

  putLeaguePending: (opts) => ({
    type: leagueActions.PUT_LEAGUE_PENDING,
    payload: {
      opts
    }
  }),

  putLeagueFailed: (opts, error) => ({
    type: leagueActions.PUT_LEAGUE_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putLeagueFulfilled: (opts, data) => ({
    type: leagueActions.PUT_LEAGUE_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const putLeagueActions = {
  failed: leagueActions.putLeagueFailed,
  pending: leagueActions.putLeaguePending,
  fulfilled: leagueActions.putLeagueFulfilled
}
