export const playerActions = {
  LOAD_ALL_PLAYERS: 'LOAD_ALL_PLAYERS',
  LOAD_LEAGUE_PLAYERS: 'LOAD_LEAGUE_PLAYERS',
  LOAD_TEAM_PLAYERS: 'LOAD_TEAM_PLAYERS',

  SET_WATCHLIST: 'SET_WATCHLIST',
  TOGGLE_WATCHLIST: 'TOGGLE_WATCHLIST',

  SEARCH_PLAYERS: 'SEARCH_PLAYERS',
  FILTER_PLAYERS: 'FILTER_PLAYERS',
  TOGGLE_WATCHLIST_ONLY: 'TOGGLE_WATCHLIST_ONLY',
  TOGGLE_ORDER: 'TOGGLE_ORDER',
  SET_ORDER: 'SET_ORDER',
  PLAYERS_SELECT_PLAYER: 'PLAYERS_SELECT_PLAYER',
  PLAYERS_DESELECT_PLAYER: 'PLAYERS_DESELECT_PLAYER',

  SET_PLAYER_VALUES: 'SET_PLAYER_VALUES',
  SET_PLAYER_STATS: 'SET_PLAYER_STATS',
  SET_PROJECTED_CONTRIBUTION: 'SET_PROJECTED_CONTRIBUTION',

  FETCH_PLAYERS_FAILED: 'FETCH_PLAYERS_FAILED',
  FETCH_PLAYERS_FULFILLED: 'FETCH_PLAYERS_FULFILLED',
  FETCH_PLAYERS_PENDING: 'FETCH_PLAYERS_PENDING',

  FETCH_ALL_PLAYERS_FAILED: 'FETCH_ALL_PLAYERS_FAILED',
  FETCH_ALL_PLAYERS_FULFILLED: 'FETCH_ALL_PLAYERS_FULFILLED',
  FETCH_ALL_PLAYERS_PENDING: 'FETCH_ALL_PLAYERS_PENDING',

  FETCH_LEAGUE_PLAYERS_FAILED: 'FETCH_LEAGUE_PLAYERS_FAILED',
  FETCH_LEAGUE_PLAYERS_FULFILLED: 'FETCH_LEAGUE_PLAYERS_FULFILLED',
  FETCH_LEAGUE_PLAYERS_PENDING: 'FETCH_LEAGUE_PLAYERS_PENDING',

  FETCH_TEAM_PLAYERS_FAILED: 'FETCH_TEAM_PLAYERS_FAILED',
  FETCH_TEAM_PLAYERS_FULFILLED: 'FETCH_TEAM_PLAYERS_FULFILLED',
  FETCH_TEAM_PLAYERS_PENDING: 'FETCH_TEAM_PLAYERS_PENDING',

  SEARCH_PLAYERS_FAILED: 'SEARCH_PLAYERS_FAILED',
  SEARCH_PLAYERS_PENDING: 'SEARCH_PLAYERS_PENDING',
  SEARCH_PLAYERS_FULFILLED: 'SEARCH_PLAYERS_FULFILLED',

  GET_PLAYER_FAILED: 'GET_PLAYER_FAILED',
  GET_PLAYER_PENDING: 'GET_PLAYER_PENDING',
  GET_PLAYER_FULFILLED: 'GET_PLAYER_FULFILLED',

  GET_PLAYER_TRANSACTIONS: 'GET_PLAYER_TRANSACTIONS',
  GET_PLAYER_TRANSACTIONS_FAILED: 'GET_PLAYER_TRANSACTIONS_FAILED',
  GET_PLAYER_TRANSACTIONS_PENDING: 'GET_PLAYER_TRANSACTIONS_PENDING',
  GET_PLAYER_TRANSACTIONS_FULFILLED: 'GET_PLAYER_TRANSACTIONS_FULFILLED',

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

  SELECT_PLAYERS_VIEW: 'SELECT_PLAYERS_VIEW',

  GET_CUTLIST_FULFILLED: 'GET_CUTLIST_FULFILLED',
  GET_CUTLIST_PENDING: 'GET_CUTLIST_PENDING',
  GET_CUTLIST_FAILED: 'GET_CUTLIST_FAILED',

  TOGGLE_CUTLIST: 'TOGGLE_CUTLIST',
  REORDER_CUTLIST: 'REORDER_CUTLIST',

  POST_CUTLIST_FULFILLED: 'POST_CUTLIST_FULFILLED',
  POST_CUTLIST_PENDING: 'POST_CUTLIST_PENDING',
  POST_CUTLIST_FAILED: 'POST_CUTLIST_FAILED',

  GET_BASELINES_FULFILLED: 'GET_BASELINES_FULFILLED',
  GET_BASELINES_PENDING: 'GET_BASELINES_PENDING',
  GET_BASELINES_FAILED: 'GET_BASELINES_FAILED',

  GET_PLAYER_PROJECTIONS: 'GET_PLAYER_PROJECTIONS',

  GET_PLAYER_PROJECTIONS_FULFILLED: 'GET_PLAYER_PROJECTIONS_FULFILLED',
  GET_PLAYER_PROJECTIONS_FAILED: 'GET_PLAYER_PROJECTIONS_FAILED',
  GET_PLAYER_PROJECTIONS_PENDING: 'GET_PLAYER_PROJECTIONS_PENDING',

  LOAD_PLAYER_GAMELOGS: 'LOAD_PLAYER_GAMELOGS',

  GET_PLAYER_GAMELOGS_FULFILLED: 'GET_PLAYER_GAMELOGS_FULFILLED',
  GET_PLAYER_GAMELOGS_FAILED: 'GET_PLAYER_GAMELOGS_FAILED',
  GET_PLAYER_GAMELOGS_PENDING: 'GET_PLAYER_GAMELOGS_PENDING',

  LOAD_PLAYER_PRACTICES: 'LOAD_PLAYER_PRACTICES',

  GET_PLAYER_PRACTICES_FULFILLED: 'GET_PLAYER_PRACTICES_FULFILLED',
  GET_PLAYER_PRACTICES_FAILED: 'GET_PLAYER_PRACTICES_FAILED',
  GET_PLAYER_PRACTICES_PENDING: 'GET_PLAYER_PRACTICES_PENDING',

  RESET_PLAYER_FILTER_OPTIONS: 'RESET_PLAYER_FILTER_OPTIONS',

  loadAllPlayers: () => ({
    type: playerActions.LOAD_ALL_PLAYERS
  }),

  loadLeaguePlayers: () => ({
    type: playerActions.LOAD_LEAGUE_PLAYERS
  }),

  loadTeamPlayers: ({ leagueId, teamId }) => ({
    type: playerActions.LOAD_TEAM_PLAYERS,
    payload: {
      leagueId,
      teamId
    }
  }),

  getPlayerProjections: (pid) => ({
    type: playerActions.GET_PLAYER_PROJECTIONS,
    payload: {
      pid
    }
  }),

  setStats: ({ players, percentiles }) => ({
    type: playerActions.SET_PLAYER_STATS,
    payload: {
      players,
      percentiles
    }
  }),

  select_players_view: (view_key) => ({
    type: playerActions.SELECT_PLAYERS_VIEW,
    payload: {
      view_key
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

  toggleWatchlist: (pid) => ({
    type: playerActions.TOGGLE_WATCHLIST,
    payload: {
      pid
    }
  }),

  selectPlayer: (pid) => ({
    type: playerActions.PLAYERS_SELECT_PLAYER,
    payload: {
      pid
    }
  }),

  deselectPlayer: () => ({
    type: playerActions.PLAYERS_DESELECT_PLAYER
  }),

  saveProjection: ({ pid, value, type, userId, week }) => ({
    type: playerActions.SAVE_PROJECTION,
    payload: {
      userId,
      pid,
      value,
      type,
      week
    }
  }),

  deleteProjection: ({ pid, week }) => ({
    type: playerActions.DELETE_PROJECTION,
    payload: {
      pid,
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

  filter: ({ type, values }) => ({
    type: playerActions.FILTER_PLAYERS,
    payload: {
      type,
      values
    }
  }),

  toggleWatchlistOnly: () => ({
    type: playerActions.TOGGLE_WATCHLIST_ONLY
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

  fetchAllPlayersPending: (opts) => ({
    type: playerActions.FETCH_ALL_PLAYERS_PENDING,
    payload: {
      opts
    }
  }),

  fetchAllPlayersFulfilled: (opts, data) => ({
    type: playerActions.FETCH_ALL_PLAYERS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  fetchAllPlayersFailed: (opts, error) => ({
    type: playerActions.FETCH_ALL_PLAYERS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  fetchLeaguePlayersPending: (opts) => ({
    type: playerActions.FETCH_LEAGUE_PLAYERS_PENDING,
    payload: {
      opts
    }
  }),

  fetchLeaguePlayersFulfilled: (opts, data) => ({
    type: playerActions.FETCH_LEAGUE_PLAYERS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  fetchLeaguePlayersFailed: (opts, error) => ({
    type: playerActions.FETCH_LEAGUE_PLAYERS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  fetchTeamPlayersPending: (opts) => ({
    type: playerActions.FETCH_TEAM_PLAYERS_PENDING,
    payload: {
      opts
    }
  }),

  fetchTeamPlayersFulfilled: (opts, data) => ({
    type: playerActions.FETCH_TEAM_PLAYERS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  fetchTeamPlayersFailed: (opts, error) => ({
    type: playerActions.FETCH_TEAM_PLAYERS_FAILED,
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

  toggleCutlist: (pid) => ({
    type: playerActions.TOGGLE_CUTLIST,
    payload: {
      pid
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
  }),

  getPlayerTransactions: (pid) => ({
    type: playerActions.GET_PLAYER_TRANSACTIONS,
    payload: {
      pid
    }
  }),

  getPlayerTransactionsPending: (opts) => ({
    type: playerActions.GET_PLAYER_TRANSACTIONS_PENDING,
    payload: {
      opts
    }
  }),

  getPlayerTransactionsFulfilled: (opts, data) => ({
    type: playerActions.GET_PLAYER_TRANSACTIONS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlayerTransactionsFailed: (opts, error) => ({
    type: playerActions.GET_PLAYER_TRANSACTIONS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getBaselinesFailed: (opts, error) => ({
    type: playerActions.GET_BASELINES_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getBaselinesPending: (opts) => ({
    type: playerActions.GET_BASELINES_PENDING,
    payload: {
      opts
    }
  }),

  getBaselinesFulfilled: (opts, data) => ({
    type: playerActions.GET_BASELINES_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlayerProjectionsFulfilled: (opts, data) => ({
    type: playerActions.GET_PLAYER_PROJECTIONS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlayerProjectionsPending: (opts) => ({
    type: playerActions.GET_PLAYER_PROJECTIONS_PENDING,
    payload: {
      opts
    }
  }),

  getPlayerProjectionsFailed: (opts, error) => ({
    type: playerActions.GET_PLAYER_PROJECTIONS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  loadPlayerGamelogs: (pid) => ({
    type: playerActions.LOAD_PLAYER_GAMELOGS,
    payload: {
      pid
    }
  }),

  getPlayerGamelogsFulfilled: (opts, data) => ({
    type: playerActions.GET_PLAYER_GAMELOGS_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlayerGamelogsPending: (opts) => ({
    type: playerActions.GET_PLAYER_GAMELOGS_PENDING,
    payload: {
      opts
    }
  }),

  getPlayerGamelogsFailed: (opts, error) => ({
    type: playerActions.GET_PLAYER_GAMELOGS_FAILED,
    payload: {
      opts,
      error
    }
  }),

  loadPlayerPractices: (pid) => ({
    type: playerActions.LOAD_PLAYER_PRACTICES,
    payload: {
      pid
    }
  }),

  getPlayerPracticesFulfilled: (opts, data) => ({
    type: playerActions.GET_PLAYER_PRACTICES_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getPlayerPracticesPending: (opts) => ({
    type: playerActions.GET_PLAYER_PRACTICES_PENDING,
    payload: {
      opts
    }
  }),

  getPlayerPracticesFailed: (opts, error) => ({
    type: playerActions.GET_PLAYER_PRACTICES_FAILED,
    payload: {
      opts,
      error
    }
  }),

  reset_player_filter_options: () => ({
    type: playerActions.RESET_PLAYER_FILTER_OPTIONS
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

export const allPlayersRequestActions = {
  failed: playerActions.fetchAllPlayersFailed,
  fulfilled: playerActions.fetchAllPlayersFulfilled,
  pending: playerActions.fetchAllPlayersPending
}

export const leaguePlayersRequestActions = {
  failed: playerActions.fetchLeaguePlayersFailed,
  fulfilled: playerActions.fetchLeaguePlayersFulfilled,
  pending: playerActions.fetchLeaguePlayersPending
}

export const teamPlayersRequestActions = {
  failed: playerActions.fetchTeamPlayersFailed,
  fulfilled: playerActions.fetchTeamPlayersFulfilled,
  pending: playerActions.fetchTeamPlayersPending
}

export const getPlayerActions = {
  failed: playerActions.getPlayerFailed,
  fulfilled: playerActions.getPlayerFulfilled,
  pending: playerActions.getPlayerPending
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

export const getPlayerTransactionsActions = {
  failed: playerActions.getPlayerTransactionsFailed,
  pending: playerActions.getPlayerTransactionsPending,
  fulfilled: playerActions.getPlayerTransactionsFulfilled
}

export const getBaselinesActions = {
  failed: playerActions.getBaselinesFailed,
  pending: playerActions.getBaselinesPending,
  fulfilled: playerActions.getBaselinesFulfilled
}

export const getPlayerProjectionsActions = {
  failed: playerActions.getPlayerProjectionsFailed,
  pending: playerActions.getPlayerProjectionsPending,
  fulfilled: playerActions.getPlayerProjectionsFulfilled
}

export const getPlayerGamelogsActions = {
  failed: playerActions.getPlayerGamelogsFailed,
  pending: playerActions.getPlayerGamelogsPending,
  fulfilled: playerActions.getPlayerGamelogsFulfilled
}

export const getPlayerPracticesActions = {
  failed: playerActions.getPlayerPracticesFailed,
  pending: playerActions.getPlayerPracticesPending,
  fulfilled: playerActions.getPlayerPracticesFulfilled
}
