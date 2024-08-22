import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const playerActions = {
  LOAD_ALL_PLAYERS: 'LOAD_ALL_PLAYERS',
  loadAllPlayers: () => ({
    type: playerActions.LOAD_ALL_PLAYERS
  }),

  LOAD_LEAGUE_PLAYERS: 'LOAD_LEAGUE_PLAYERS',
  loadLeaguePlayers: () => ({
    type: playerActions.LOAD_LEAGUE_PLAYERS
  }),

  LOAD_TEAM_PLAYERS: 'LOAD_TEAM_PLAYERS',
  loadTeamPlayers: ({ leagueId, teamId }) => ({
    type: playerActions.LOAD_TEAM_PLAYERS,
    payload: {
      leagueId,
      teamId
    }
  }),

  SET_WATCHLIST: 'SET_WATCHLIST',
  setWatchlist: (watchlist) => ({
    type: playerActions.SET_WATCHLIST,
    payload: {
      watchlist
    }
  }),
  TOGGLE_WATCHLIST: 'TOGGLE_WATCHLIST',
  toggleWatchlist: (pid) => ({
    type: playerActions.TOGGLE_WATCHLIST,
    payload: {
      pid
    }
  }),

  SEARCH_PLAYERS: 'SEARCH_PLAYERS',
  search: (value) => ({
    type: playerActions.SEARCH_PLAYERS,
    payload: {
      value
    }
  }),
  FILTER_PLAYERS: 'FILTER_PLAYERS',
  filter: ({ type, values }) => ({
    type: playerActions.FILTER_PLAYERS,
    payload: {
      type,
      values
    }
  }),
  TOGGLE_WATCHLIST_ONLY: 'TOGGLE_WATCHLIST_ONLY',
  toggleWatchlistOnly: () => ({
    type: playerActions.TOGGLE_WATCHLIST_ONLY
  }),
  TOGGLE_PLAYERS_PAGE_ORDER: 'TOGGLE_PLAYERS_PAGE_ORDER',
  toggle_players_page_order: (orderBy) => ({
    type: playerActions.TOGGLE_PLAYERS_PAGE_ORDER,
    payload: {
      orderBy
    }
  }),
  SET_PLAYERS_PAGE_ORDER: 'SET_PLAYERS_PAGE_ORDER',
  set_players_order: ({ order, orderBy }) => ({
    type: playerActions.SET_PLAYERS_PAGE_ORDER,
    payload: {
      order,
      orderBy
    }
  }),
  PLAYERS_SELECT_PLAYER: 'PLAYERS_SELECT_PLAYER',
  selectPlayer: (pid) => ({
    type: playerActions.PLAYERS_SELECT_PLAYER,
    payload: {
      pid
    }
  }),
  PLAYERS_DESELECT_PLAYER: 'PLAYERS_DESELECT_PLAYER',
  deselectPlayer: () => ({
    type: playerActions.PLAYERS_DESELECT_PLAYER
  }),

  SET_PLAYER_VALUES: 'SET_PLAYER_VALUES',
  setValues: ({ players, baselines }) => ({
    type: playerActions.SET_PLAYER_VALUES,
    payload: {
      players,
      baselines
    }
  }),
  SET_PLAYER_STATS: 'SET_PLAYER_STATS',
  setStats: ({ players, percentiles }) => ({
    type: playerActions.SET_PLAYER_STATS,
    payload: {
      players,
      percentiles
    }
  }),
  SET_PROJECTED_CONTRIBUTION: 'SET_PROJECTED_CONTRIBUTION',
  setProjectedContribution: (players) => ({
    type: playerActions.SET_PROJECTED_CONTRIBUTION,
    payload: {
      players
    }
  }),

  ...create_api_action_types('FETCH_PLAYERS'),
  ...create_api_action_types('FETCH_ALL_PLAYERS'),
  ...create_api_action_types('FETCH_LEAGUE_PLAYERS'),
  ...create_api_action_types('FETCH_TEAM_PLAYERS'),
  ...create_api_action_types('SEARCH_PLAYERS'),
  ...create_api_action_types('GET_PLAYER'),
  ...create_api_action_types('GET_PLAYER_TRANSACTIONS'),

  GET_PLAYER_TRANSACTIONS: 'GET_PLAYER_TRANSACTIONS',
  getPlayerTransactions: (pid) => ({
    type: playerActions.GET_PLAYER_TRANSACTIONS,
    payload: {
      pid
    }
  }),

  SAVE_PROJECTION: 'SAVE_PROJECTION',
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
  DELETE_PROJECTION: 'DELETE_PROJECTION',
  deleteProjection: ({ pid, week }) => ({
    type: playerActions.DELETE_PROJECTION,
    payload: {
      pid,
      week
    }
  }),
  SET_PROJECTION: 'SET_PROJECTION',
  setProjection: (opts) => ({
    type: playerActions.SET_PROJECTION,
    payload: {
      opts
    }
  }),
  REMOVE_PROJECTION: 'REMOVE_PROJECTION',
  removeProjection: (opts) => ({
    type: playerActions.REMOVE_PROJECTION,
    payload: {
      opts
    }
  }),

  ...create_api_action_types('PUT_PROJECTION'),
  ...create_api_action_types('DEL_PROJECTION'),

  SELECT_PLAYERS_PAGE_VIEW: 'SELECT_PLAYERS_PAGE_VIEW',
  select_players_page_view: (view_key) => ({
    type: playerActions.SELECT_PLAYERS_PAGE_VIEW,
    payload: {
      view_key
    }
  }),

  ...create_api_action_types('GET_CUTLIST'),
  TOGGLE_CUTLIST: 'TOGGLE_CUTLIST',
  toggleCutlist: (pid) => ({
    type: playerActions.TOGGLE_CUTLIST,
    payload: {
      pid
    }
  }),
  REORDER_CUTLIST: 'REORDER_CUTLIST',
  reorderCutlist: ({ oldIndex, newIndex }) => ({
    type: playerActions.REORDER_CUTLIST,
    payload: {
      oldIndex,
      newIndex
    }
  }),

  ...create_api_action_types('POST_CUTLIST'),
  ...create_api_action_types('GET_BASELINES'),

  GET_PLAYER_PROJECTIONS: 'GET_PLAYER_PROJECTIONS',
  getPlayerProjections: (pid) => ({
    type: playerActions.GET_PLAYER_PROJECTIONS,
    payload: {
      pid
    }
  }),
  ...create_api_action_types('GET_PLAYER_PROJECTIONS'),

  LOAD_PLAYER_PRACTICES: 'LOAD_PLAYER_PRACTICES',
  loadPlayerPractices: (pid) => ({
    type: playerActions.LOAD_PLAYER_PRACTICES,
    payload: {
      pid
    }
  }),
  LOAD_PLAYER_GAMELOGS: 'LOAD_PLAYER_GAMELOGS',
  loadPlayerGamelogs: (pid) => ({
    type: playerActions.LOAD_PLAYER_GAMELOGS,
    payload: {
      pid
    }
  }),
  ...create_api_action_types('GET_PLAYER_GAMELOGS'),
  ...create_api_action_types('GET_PLAYER_PRACTICES'),

  RESET_PLAYER_FILTER_OPTIONS: 'RESET_PLAYER_FILTER_OPTIONS',
  reset_player_filter_options: () => ({
    type: playerActions.RESET_PLAYER_FILTER_OPTIONS
  }),

  LOAD_PLAYER_BETTING_MARKETS: 'LOAD_PLAYER_BETTING_MARKETS',
  load_player_betting_markets: (pid) => ({
    type: playerActions.LOAD_PLAYER_BETTING_MARKETS,
    payload: {
      pid
    }
  }),
  ...create_api_action_types('GET_PLAYER_BETTING_MARKETS')
}

export const playersSearchActions = create_api_actions('SEARCH_PLAYERS')
export const playersRequestActions = create_api_actions('FETCH_PLAYERS')
export const allPlayersRequestActions = create_api_actions('FETCH_ALL_PLAYERS')
export const leaguePlayersRequestActions = create_api_actions(
  'FETCH_LEAGUE_PLAYERS'
)
export const teamPlayersRequestActions =
  create_api_actions('FETCH_TEAM_PLAYERS')
export const getPlayerActions = create_api_actions('GET_PLAYER')
export const putProjectionActions = create_api_actions('PUT_PROJECTION')
export const delProjectionActions = create_api_actions('DEL_PROJECTION')
export const getCutlistActions = create_api_actions('GET_CUTLIST')
export const postCutlistActions = create_api_actions('POST_CUTLIST')
export const getPlayerTransactionsActions = create_api_actions(
  'GET_PLAYER_TRANSACTIONS'
)
export const getBaselinesActions = create_api_actions('GET_BASELINES')
export const getPlayerProjectionsActions = create_api_actions(
  'GET_PLAYER_PROJECTIONS'
)
export const getPlayerGamelogsActions = create_api_actions(
  'GET_PLAYER_GAMELOGS'
)
export const getPlayerPracticesActions = create_api_actions(
  'GET_PLAYER_PRACTICES'
)
export const get_player_betting_markets_actions = create_api_actions(
  'GET_PLAYER_BETTING_MARKETS'
)
