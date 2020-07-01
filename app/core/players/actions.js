export const playerActions = {
  LOAD_PLAYERS: 'LOAD_PLAYERS',

  SEARCH_PLAYERS: 'SEARCH_PLAYERS',
  FILTER_PLAYERS: 'FILTER_PLAYERS',
  TOGGLE_ORDER: 'TOGGLE_ORDER',
  SET_ORDER: 'SET_ORDER',
  PLAYERS_SELECT_PLAYER: 'PLAYERS_SELECT_PLAYER',
  PLAYERS_DESELECT_PLAYER: 'PLAYERS_DESELECT_PLAYER',

  CALCULATE_VALUES: 'CALCULATE_VALUES',

  FETCH_PLAYERS_FAILED: 'FETCH_PLAYERS_FAILED',
  FETCH_PLAYERS_FULFILLED: 'FETCH_PLAYERS_FULFILLED',
  FETCH_PLAYERS_PENDING: 'FETCH_PLAYERS_PENDING',

  GET_PLAYER_STATS_FAILED: 'GET_PLAYER_STATS_FAILED',
  GET_PLAYER_STATS_PENDING: 'GET_PLAYER_STATS_PENDING',
  GET_PLAYER_STATS_FULFILLED: 'GET_PLAYER_STATS_FULFILLED',

  SET_PROJECTION: 'SET_PROJECTION',
  DELETE_PROJECTION: 'DELETE_PROJECTION',

  PUT_PROJECTION_FAILED: 'PUT_PROJECTION_FAILED',
  PUT_PROJECTION_PENDING: 'PUT_PROJECTION_PENDING',
  PUT_PROJECTION_FULFILLED: 'PUT_PROJECTION_FULFILLED',

  DEL_PROJECTION_FAILED: 'DEL_PROJECTION_FAILED',
  DEL_PROJECTION_PENDING: 'DEL_PROJECTION_PENDING',
  DEL_PROJECTION_FULFILLED: 'DEL_PROJECTION_FULFILLED',

  selectPlayer: (player) => ({
    type: playerActions.PLAYERS_SELECT_PLAYER,
    payload: {
      player
    }
  }),

  deselectPlayer: () => ({
    type: playerActions.PLAYERS_DESELECT_PLAYER
  }),

  setProjection: ({ playerId, value, type, userId }) => ({
    type: playerActions.SET_PROJECTION,
    payload: {
      userId,
      playerId,
      value,
      type
    }
  }),

  deleteProjection: (playerId) => ({
    type: playerActions.DELETE_PROJECTION,
    payload: {
      playerId
    }
  }),

  load: () => ({
    type: playerActions.LOAD_PLAYERS
  }),

  calculate: ({ players, leagues, sources, userId, vorpw, volsw }) => ({
    type: playerActions.CALCULATE_VALUES,
    payload: {
      players,
      leagues,
      sources,
      userId,
      vorpw,
      volsw
    }
  }),

  filter: (type, values) => ({
    type: playerActions.FILTER_PLAYERS,
    payload: {
      type,
      values
    }
  }),

  search: (value) => ({
    type: playerActions.SEARCH_PLAYERS,
    payload: {
      value
    }
  }),

  toggle: (orderBy) => ({
    type: playerActions.TOGGLE_ORDER,
    payload: {
      orderBy
    }
  }),

  setOrder: ({ order, orderBy }) => ({
    type: playerActions.SET_ORDER,
    payload: {
      order,
      orderBy
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
  }),

  getPlayerStatsPending: opts => ({
    type: playerActions.GET_PLAYER_STATS_PENDING,
    payload: {
      opts
    }
  }),

  getPlayerStatsFulfilled: (opts, data) => ({
    type: playerActions.GET_PLAYER_STATS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlayerStatsFailed: (opts, error) => ({
    type: playerActions.GET_PLAYER_STATS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putProjectionFailed: (opts, error) => ({
    type: playerActions.PUT_PROJECTION_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putProjectionPending: (opts) => ({
    type: playerActions.PUT_PROJECTION_PENDING,
    payload: {
      opts
    }
  }),

  putProjectionFulfilled: (opts, data) => ({
    type: playerActions.PUT_PROJECTION_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  delProjectionPending: (opts) => ({
    type: playerActions.DEL_PROJECTION_PENDING,
    payload: {
      opts
    }
  }),

  delProjectionFailed: (opts, error) => ({
    type: playerActions.DEL_PROJECTION_FAILED,
    payload: {
      opts,
      error
    }
  }),

  delProjectionFulfilled: (opts, data) => ({
    type: playerActions.DEL_PROJECTION_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const playersRequestActions = {
  failed: playerActions.fetchPlayersFailed,
  fulfilled: playerActions.fetchPlayersFulfilled,
  pending: playerActions.fetchPlayersPending
}

export const getPlayerStatsActions = {
  failed: playerActions.getPlayerStatsFailed,
  fulfilled: playerActions.getPlayerStatsFulfilled,
  pending: playerActions.getPlayerStatsPending
}

export const putProjectionActions = {
  failed: playerActions.putProjectionFailed,
  fulfilled: playerActions.putProjectionFulfilled,
  pending: playerActions.putProjectionPending
}

export const delProjectionActions = {
  failed: playerActions.delProjectionFailed,
  fulfilled: playerActions.delProjectionFulfilled,
  pending: playerActions.delProjectionPending
}
