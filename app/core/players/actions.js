import { actions_utils } from '@core/utils'
const {
  create_api_actions,
  create_api_action_types,
  create_toggle_action,
  create_load_action
} = actions_utils

export const player_actions = {
  LOAD_ALL_PLAYERS: 'LOAD_ALL_PLAYERS',
  load_all_players: create_load_action('LOAD_ALL_PLAYERS'),

  LOAD_LEAGUE_PLAYERS: 'LOAD_LEAGUE_PLAYERS',
  load_league_players: create_load_action('LOAD_LEAGUE_PLAYERS'),

  LOAD_TEAM_PLAYERS: 'LOAD_TEAM_PLAYERS',
  load_team_players: ({ leagueId, teamId }) => ({
    type: player_actions.LOAD_TEAM_PLAYERS,
    payload: { leagueId, teamId }
  }),

  SET_WATCHLIST: 'SET_WATCHLIST',
  set_watchlist: (watchlist) => ({
    type: player_actions.SET_WATCHLIST,
    payload: { watchlist }
  }),
  TOGGLE_WATCHLIST: 'TOGGLE_WATCHLIST',
  toggle_watchlist: (pid) => ({
    type: player_actions.TOGGLE_WATCHLIST,
    payload: { pid }
  }),

  SEARCH_PLAYERS: 'SEARCH_PLAYERS',
  search: (value) => ({
    type: player_actions.SEARCH_PLAYERS,
    payload: { value }
  }),
  FILTER_PLAYERS: 'FILTER_PLAYERS',
  filter: ({ type, values }) => ({
    type: player_actions.FILTER_PLAYERS,
    payload: {
      type,
      values
    }
  }),
  TOGGLE_WATCHLIST_ONLY: 'TOGGLE_WATCHLIST_ONLY',
  toggle_watchlist_only: create_toggle_action('TOGGLE_WATCHLIST_ONLY'),
  TOGGLE_PLAYERS_PAGE_ORDER: 'TOGGLE_PLAYERS_PAGE_ORDER',
  toggle_players_page_order: (orderBy) => ({
    type: player_actions.TOGGLE_PLAYERS_PAGE_ORDER,
    payload: { orderBy }
  }),
  SET_PLAYERS_PAGE_ORDER: 'SET_PLAYERS_PAGE_ORDER',
  set_players_page_order: ({ order, orderBy }) => ({
    type: player_actions.SET_PLAYERS_PAGE_ORDER,
    payload: { order, orderBy }
  }),
  PLAYERS_SELECT_PLAYER: 'PLAYERS_SELECT_PLAYER',
  select_player: (pid) => ({
    type: player_actions.PLAYERS_SELECT_PLAYER,
    payload: { pid }
  }),
  PLAYERS_DESELECT_PLAYER: 'PLAYERS_DESELECT_PLAYER',
  deselect_player: create_toggle_action('PLAYERS_DESELECT_PLAYER'),

  SET_PLAYER_VALUES: 'SET_PLAYER_VALUES',
  set_values: ({ players, baselines }) => ({
    type: player_actions.SET_PLAYER_VALUES,
    payload: {
      players,
      baselines
    }
  }),
  SET_PLAYER_STATS: 'SET_PLAYER_STATS',
  set_stats: ({ players, percentiles }) => ({
    type: player_actions.SET_PLAYER_STATS,
    payload: {
      players,
      percentiles
    }
  }),
  SET_PROJECTED_CONTRIBUTION: 'SET_PROJECTED_CONTRIBUTION',
  set_projected_contribution: (players) => ({
    type: player_actions.SET_PROJECTED_CONTRIBUTION,
    payload: { players }
  }),

  ...create_api_action_types('FETCH_PLAYERS'),
  ...create_api_action_types('FETCH_ALL_PLAYERS'),
  ...create_api_action_types('FETCH_LEAGUE_PLAYERS'),
  ...create_api_action_types('FETCH_TEAM_PLAYERS'),
  ...create_api_action_types('SEARCH_PLAYERS'),
  ...create_api_action_types('GET_PLAYER'),
  ...create_api_action_types('GET_PLAYER_TRANSACTIONS'),

  LOAD_PLAYER_TRANSACTIONS: 'LOAD_PLAYER_TRANSACTIONS',
  load_player_transactions: create_load_action('LOAD_PLAYER_TRANSACTIONS'),

  SAVE_PROJECTION: 'SAVE_PROJECTION',
  save_projection: ({ pid, value, type, userId, week }) => ({
    type: player_actions.SAVE_PROJECTION,
    payload: {
      userId,
      pid,
      value,
      type,
      week
    }
  }),
  DELETE_PROJECTION: 'DELETE_PROJECTION',
  delete_projection: ({ pid, week }) => ({
    type: player_actions.DELETE_PROJECTION,
    payload: {
      pid,
      week
    }
  }),
  SET_PROJECTION: 'SET_PROJECTION',
  set_projection: (opts) => ({
    type: player_actions.SET_PROJECTION,
    payload: { opts }
  }),
  REMOVE_PROJECTION: 'REMOVE_PROJECTION',
  remove_projection: (opts) => ({
    type: player_actions.REMOVE_PROJECTION,
    payload: { opts }
  }),

  ...create_api_action_types('PUT_PROJECTION'),
  ...create_api_action_types('DEL_PROJECTION'),

  SELECT_PLAYERS_PAGE_VIEW: 'SELECT_PLAYERS_PAGE_VIEW',
  select_players_page_view: (view_key) => ({
    type: player_actions.SELECT_PLAYERS_PAGE_VIEW,
    payload: { view_key }
  }),

  ...create_api_action_types('GET_CUTLIST'),
  TOGGLE_CUTLIST: 'TOGGLE_CUTLIST',
  toggle_cutlist: (pid) => ({
    type: player_actions.TOGGLE_CUTLIST,
    payload: { pid }
  }),
  REORDER_CUTLIST: 'REORDER_CUTLIST',
  reorder_cutlist: ({ oldIndex, newIndex }) => ({
    type: player_actions.REORDER_CUTLIST,
    payload: {
      oldIndex,
      newIndex
    }
  }),

  ...create_api_action_types('POST_CUTLIST'),
  ...create_api_action_types('GET_BASELINES'),

  LOAD_PLAYER_PROJECTIONS: 'LOAD_PLAYER_PROJECTIONS',
  load_player_projections: create_load_action('LOAD_PLAYER_PROJECTIONS'),
  ...create_api_action_types('GET_PLAYER_PROJECTIONS'),

  LOAD_PLAYER_PRACTICES: 'LOAD_PLAYER_PRACTICES',
  load_player_practices: (pid) => ({
    type: player_actions.LOAD_PLAYER_PRACTICES,
    payload: { pid }
  }),
  LOAD_PLAYER_GAMELOGS: 'LOAD_PLAYER_GAMELOGS',
  load_player_gamelogs: create_load_action('LOAD_PLAYER_GAMELOGS'),
  ...create_api_action_types('GET_PLAYER_GAMELOGS'),
  ...create_api_action_types('GET_PLAYER_PRACTICES'),

  RESET_PLAYER_FILTER_OPTIONS: 'RESET_PLAYER_FILTER_OPTIONS',
  reset_player_filter_options: create_toggle_action(
    'RESET_PLAYER_FILTER_OPTIONS'
  ),

  LOAD_PLAYER_BETTING_MARKETS: 'LOAD_PLAYER_BETTING_MARKETS',
  load_player_betting_markets: (pid) => ({
    type: player_actions.LOAD_PLAYER_BETTING_MARKETS,
    payload: { pid }
  }),
  ...create_api_action_types('GET_PLAYER_BETTING_MARKETS')
}

export const players_search_actions = create_api_actions('SEARCH_PLAYERS')
export const players_request_actions = create_api_actions('FETCH_PLAYERS')
export const all_players_request_actions =
  create_api_actions('FETCH_ALL_PLAYERS')
export const league_players_request_actions = create_api_actions(
  'FETCH_LEAGUE_PLAYERS'
)
export const team_players_request_actions =
  create_api_actions('FETCH_TEAM_PLAYERS')
export const get_player_actions = create_api_actions('GET_PLAYER')
export const put_projection_actions = create_api_actions('PUT_PROJECTION')
export const del_projection_actions = create_api_actions('DEL_PROJECTION')
export const get_cutlist_actions = create_api_actions('GET_CUTLIST')
export const post_cutlist_actions = create_api_actions('POST_CUTLIST')
export const get_player_transactions_actions = create_api_actions(
  'GET_PLAYER_TRANSACTIONS'
)
export const get_baselines_actions = create_api_actions('GET_BASELINES')
export const get_player_projections_actions = create_api_actions(
  'GET_PLAYER_PROJECTIONS'
)
export const get_player_gamelogs_actions = create_api_actions(
  'GET_PLAYER_GAMELOGS'
)
export const get_player_practices_actions = create_api_actions(
  'GET_PLAYER_PRACTICES'
)
export const get_player_betting_markets_actions = create_api_actions(
  'GET_PLAYER_BETTING_MARKETS'
)
