export const playerActions = {
  LOAD_PLAYERS: 'LOAD_PLAYERS',

  FILTER_PLAYERS: 'FILTER_PLAYERS',
  TOGGLE_ORDER: 'TOGGLE_ORDER',
  SET_ORDER: 'SET_ORDER',
  PLAYERS_SELECT_PLAYER: 'PLAYERS_SELECT_PLAYER',

  CALCULATE_VALUES: 'CALCULATE_VALUES',

  FETCH_PLAYERS_FAILED: 'FETCH_PLAYERS_FAILED',
  FETCH_PLAYERS_FULFILLED: 'FETCH_PLAYERS_FULFILLED',
  FETCH_PLAYERS_PENDING: 'FETCH_PLAYERS_PENDING',

  GET_PLAYER_STATS_FAILED: 'GET_PLAYER_STATS_FAILED',
  GET_PLAYER_STATS_PENDING: 'GET_PLAYER_STATS_PENDING',
  GET_PLAYER_STATS_FULFILLED: 'GET_PLAYER_STATS_FULFILLED',

  SET_PROJECTION: 'SET_PROJECTION',

  selectPlayer: (player) => ({
    type: playerActions.PLAYERS_SELECT_PLAYER,
    payload: {
      player
    }
  }),

  setProjection: ({ playerId, value, type, week, userId }) => ({
    type: playerActions.SET_PROJECTION,
    payload: {
      userId,
      playerId,
      value,
      type,
      week
    }
  }),

  load: () => ({
    type: playerActions.LOAD_PLAYERS
  }),

  calculate: ({ players, leagues, userId }) => ({
    type: playerActions.CALCULATE_VALUES,
    payload: {
      players,
      leagues,
      userId
    }
  }),

  filter: (type, values) => ({
    type: playerActions.FILTER_PLAYERS,
    payload: {
      type,
      values
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
