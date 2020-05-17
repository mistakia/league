export const playerActions = {
  LOAD_PLAYERS: 'LOAD_PLAYERS',
  FILTER_POSITIONS: 'FILTER_POSITIONS',

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

  filterPositions: (positions) => ({
    type: playerActions.FILTER_POSITIONS,
    payload: {
      positions
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
