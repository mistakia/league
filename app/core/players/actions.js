export const playerActions = {
  LOAD_PLAYERS: 'LOAD_PLAYERS',

  FILTER_PLAYERS: 'FILTER_PLAYERS',

  CALCULATE_VALUES: 'CALCULATE_VALUES',

  FETCH_PLAYERS_FAILED: 'FETCH_PLAYERS_FAILED',
  FETCH_PLAYERS_FULFILLED: 'FETCH_PLAYERS_FULFILLED',
  FETCH_PLAYERS_PENDING: 'FETCH_PLAYERS_PENDING',

  load: () => ({
    type: playerActions.LOAD_PLAYERS
  }),

  calculate: ({ players, leagues }) => ({
    type: playerActions.CALCULATE_VALUES,
    payload: {
      players,
      leagues
    }
  }),

  filter: (type, values) => ({
    type: playerActions.FILTER_PLAYERS,
    payload: {
      type,
      values
    }
  }),

  fetchPlayersPending: (opts) => ({
    type: playerActions.FETCH_PLAYERS_PENDING,
    payload: {
      opts
    }
  }),

  fetchPlayersFulfilled: (opts, data) => ({
    type: playerActions.FETCH_PLAYERS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  fetchPlayersFailed: (opts, error) => ({
    type: playerActions.FETCH_PLAYERS_FAILED,
    payload: {
      opts,
      error
    }
  })
}

export const playerRequestActions = {
  failed: playerActions.fetchPlayersFailed,
  fulfilled: playerActions.fetchPlayersFulfilled,
  pending: playerActions.fetchPlayersPending
}
