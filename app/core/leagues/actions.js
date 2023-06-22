export const leagueActions = {
  LOAD_LEAGUE: 'LOAD_LEAGUE',
  UPDATE_LEAGUE: 'UPDATE_LEAGUE',
  SET_LEAGUE: 'SET_LEAGUE',

  PUT_LEAGUE_FAILED: 'PUT_LEAGUE_FAILED',
  PUT_LEAGUE_PENDING: 'PUT_LEAGUE_PENDING',
  PUT_LEAGUE_FULFILLED: 'PUT_LEAGUE_FULFILLED',

  GET_LEAGUE_FAILED: 'GET_LEAGUE_FAILED',
  GET_LEAGUE_PENDING: 'GET_LEAGUE_PENDING',
  GET_LEAGUE_FULFILLED: 'GET_LEAGUE_FULFILLED',

  load_league: () => ({
    type: leagueActions.LOAD_LEAGUE
  }),

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
  }),

  getLeaguePending: (opts) => ({
    type: leagueActions.GET_LEAGUE_PENDING,
    payload: {
      opts
    }
  }),

  getLeagueFailed: (opts, error) => ({
    type: leagueActions.GET_LEAGUE_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getLeagueFulfilled: (opts, data) => ({
    type: leagueActions.GET_LEAGUE_FULFILLED,
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

export const getLeagueActions = {
  failed: leagueActions.getLeagueFailed,
  pending: leagueActions.getLeaguePending,
  fulfilled: leagueActions.getLeagueFulfilled
}
