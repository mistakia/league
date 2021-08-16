export const playerActions = {
  LOAD_PLAYERS: 'LOAD_PLAYERS',

  SET_WATCHLIST: 'SET_WATCHLIST',
  TOGGLE_WATCHLIST: 'TOGGLE_WATCHLIST',

  SEARCH_PLAYERS: 'SEARCH_PLAYERS',
  FILTER_PLAYERS: 'FILTER_PLAYERS',
  TOGGLE_ORDER: 'TOGGLE_ORDER',
  SET_ORDER: 'SET_ORDER',
  PLAYERS_SELECT_PLAYER: 'PLAYERS_SELECT_PLAYER',
  PLAYERS_DESELECT_PLAYER: 'PLAYERS_DESELECT_PLAYER',

  SET_PLAYER_VALUES: 'SET_PLAYER_VALUES',
  SET_PLAYER_STATS: 'SET_PLAYER_STATS',
  SET_PROJECTED_CONTRIBUTION: 'SET_PROJECTED_CONTRIBUTION',

  UPDATE_PLAYER_BASELINE: 'UPDATE_PLAYER_BASELINE',

  FETCH_PLAYERS_FAILED: 'FETCH_PLAYERS_FAILED',
  FETCH_PLAYERS_FULFILLED: 'FETCH_PLAYERS_FULFILLED',
  FETCH_PLAYERS_PENDING: 'FETCH_PLAYERS_PENDING',

  SEARCH_PLAYERS_FAILED: 'SEARCH_PLAYERS_FAILED',
  SEARCH_PLAYERS_PENDING: 'SEARCH_PLAYERS_PENDING',
  SEARCH_PLAYERS_FULFILLED: 'SEARCH_PLAYERS_FULFILLED',

  GET_PLAYER_FAILED: 'GET_PLAYER_FAILED',
  GET_PLAYER_PENDING: 'GET_PLAYER_PENDING',
  GET_PLAYER_FULFILLED: 'GET_PLAYER_FULFILLED',

  GET_PROJECTIONS_FAILED: 'GET_PROJECTIONS_FAILED',
  GET_PROJECTIONS_PENDING: 'GET_PROJECTIONS_PENDING',
  GET_PROJECTIONS_FULFILLED: ' GET_PROJECTIONS_FULFILLED',

  SAVE_PROJECTION: 'SAVE_PROJECTION',
  DELETE_PROJECTION: 'DELETE_PROJECTION',
  SET_PROJECTION: 'SET_PROJECTION',
  REMOVE_PROJECTION: 'REMOVE_PROJECTION',

  PUT_PROJECTION_FAILED: 'PUT_PROJECTION_FAILED',
  PUT_PROJECTION_PENDING: 'PUT_PROJECTION_PENDING',
  PUT_PROJECTION_FULFILLED: 'PUT_PROJECTION_FULFILLED',

  DEL_PROJECTION_FAILED: 'DEL_PROJECTION_FAILED',
  DEL_PROJECTION_PENDING: 'DEL_PROJECTION_PENDING',
  DEL_PROJECTION_FULFILLED: 'DEL_PROJECTION_FULFILLED',

  SET_PLAYERS_VIEW: 'SET_PLAYERS_VIEW',

  GET_CUTLIST_FULFILLED: 'GET_CUTLIST_FULFILLED',
  GET_CUTLIST_PENDING: 'GET_CUTLIST_PENDING',
  GET_CUTLIST_FAILED: 'GET_CUTLIST_FAILED',

  TOGGLE_CUTLIST: 'TOGGLE_CUTLIST',
  REORDER_CUTLIST: 'REORDER_CUTLIST',

  POST_CUTLIST_FULFILLED: 'POST_CUTLIST_FULFILLED',
  POST_CUTLIST_PENDING: 'POST_CUTLIST_PENDING',
  POST_CUTLIST_FAILED: 'POST_CUTLIST_FAILED',

  setStats: ({ players, percentiles }) => ({
    type: playerActions.SET_PLAYER_STATS,
    payload: {
      players,
      percentiles
    }
  }),

  setView: (view) => ({
    type: playerActions.SET_PLAYERS_VIEW,
    payload: {
      view
    }
  }),

  setValues: ({ players, baselines }) => ({
    type: playerActions.SET_PLAYER_VALUES,
    payload: {
      players,
      baselines
    }
  }),

  setWatchlist: (watchlist) => ({
    type: playerActions.SET_WATCHLIST,
    payload: {
      watchlist
    }
  }),

  setProjectedContribution: (players) => ({
    type: playerActions.SET_PROJECTED_CONTRIBUTION,
    payload: {
      players
    }
  }),

  updateBaseline: ({ position, value }) => ({
    type: playerActions.UPDATE_PLAYER_BASELINE,
    payload: {
      position,
      value
    }
  }),

  toggleWatchlist: (playerId) => ({
    type: playerActions.TOGGLE_WATCHLIST,
    payload: {
      playerId
    }
  }),

  selectPlayer: (player) => ({
    type: playerActions.PLAYERS_SELECT_PLAYER,
    payload: {
      player
    }
  }),

  deselectPlayer: () => ({
    type: playerActions.PLAYERS_DESELECT_PLAYER
  }),

  saveProjection: ({ playerId, value, type, userId, week }) => ({
    type: playerActions.SAVE_PROJECTION,
    payload: {
      userId,
      playerId,
      value,
      type,
      week
    }
  }),

  deleteProjection: ({ playerId, week }) => ({
    type: playerActions.DELETE_PROJECTION,
    payload: {
      playerId,
      week
    }
  }),

  setProjection: (opts) => ({
    type: playerActions.SET_PROJECTION,
    payload: {
      opts
    }
  }),

  removeProjection: (opts) => ({
    type: playerActions.REMOVE_PROJECTION,
    payload: {
      opts
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

  searchPlayersPending: (opts) => ({
    type: playerActions.SEARCH_PLAYERS_PENDING,
    payload: {
      opts
    }
  }),

  searchPlayersFulfilled: (opts, data) => ({
    type: playerActions.SEARCH_PLAYERS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  searchPlayersFailed: (opts, error) => ({
    type: playerActions.SEARCH_PLAYERS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getPlayerPending: (opts) => ({
    type: playerActions.GET_PLAYER_PENDING,
    payload: {
      opts
    }
  }),

  getPlayerFulfilled: (opts, data) => ({
    type: playerActions.GET_PLAYER_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlayerFailed: (opts, error) => ({
    type: playerActions.GET_PLAYER_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getProjectionsFailed: (opts, error) => ({
    type: playerActions.GET_PROJECTIONS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getProjectionsPending: (opts) => ({
    type: playerActions.GET_PROJECTIONS_PENDING,
    payload: {
      opts
    }
  }),

  getProjectionsFulfilled: (opts, data) => ({
    type: playerActions.GET_PROJECTIONS_FULFILLED,
    payload: {
      opts,
      data
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
  }),

  getCutlistFailed: (opts, error) => ({
    type: playerActions.GET_CUTLIST_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getCutlistPending: (opts) => ({
    type: playerActions.GET_CUTLIST_PENDING,
    payload: {
      opts
    }
  }),

  getCutlistFulfilled: (opts, data) => ({
    type: playerActions.GET_CUTLIST_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  toggleCutlist: (player) => ({
    type: playerActions.TOGGLE_CUTLIST,
    payload: {
      player
    }
  }),

  reorderCutlist: ({ oldIndex, newIndex }) => ({
    type: playerActions.REORDER_CUTLIST,
    payload: {
      oldIndex,
      newIndex
    }
  }),

  postCutlistPending: (opts) => ({
    type: playerActions.POST_CUTLIST_PENDING,
    payload: {
      opts
    }
  }),

  postCutlistFulfilled: (opts, data) => ({
    type: playerActions.POST_CUTLIST_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postCutlistFailed: (opts, error) => ({
    type: playerActions.POST_CUTLIST_FAILED,
    payload: {
      opts,
      error
    }
  })
}

export const playersSearchActions = {
  failed: playerActions.searchPlayersFailed,
  fulfilled: playerActions.searchPlayersFulfilled,
  pending: playerActions.searchPlayersPending
}

export const playersRequestActions = {
  failed: playerActions.fetchPlayersFailed,
  fulfilled: playerActions.fetchPlayersFulfilled,
  pending: playerActions.fetchPlayersPending
}

export const getPlayerActions = {
  failed: playerActions.getPlayerFailed,
  fulfilled: playerActions.getPlayerFulfilled,
  pending: playerActions.getPlayerPending
}

export const getProjectionsActions = {
  failed: playerActions.getProjectionsFailed,
  pending: playerActions.getProjectionsPending,
  fulfilled: playerActions.getProjectionsFulfilled
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

export const getCutlistActions = {
  failed: playerActions.getCutlistFailed,
  fulfilled: playerActions.getCutlistFulfilled,
  pending: playerActions.getCutlistPending
}

export const postCutlistActions = {
  failed: playerActions.postCutlistFailed,
  pending: playerActions.postCutlistPending,
  fulfilled: playerActions.postCutlistFulfilled
}
