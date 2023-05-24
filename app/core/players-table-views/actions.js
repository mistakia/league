export const players_table_views_actions = {
  PLAYERS_TABLE_VIEW_CHANGED: 'PLAYERS_TABLE_VIEW_CHANGED',

  SET_SELECTED_PLAYERS_TABLE_VIEW: 'SET_SELECTED_PLAYERS_TABLE_VIEW',

  DELETE_PLAYERS_TABLE_VIEW: 'DELETE_PLAYERS_TABLE_VIEW',

  GET_PLAYERS_TABLE_VIEWS_PENDING: 'GET_PLAYERS_TABLE_VIEWS_PENDING',
  GET_PLAYERS_TABLE_VIEWS_FULFILLED: 'GET_PLAYERS_TABLE_VIEWS_FULFILLED',
  GET_PLAYERS_TABLE_VIEWS_FAILED: 'GET_PLAYERS_TABLE_VIEWS_FAILED',

  DELETE_PLAYERS_TABLE_VIEW_PENDING: 'DELETE_PLAYERS_TABLE_VIEW_PENDING',
  DELETE_PLAYERS_TABLE_VIEW_FULFILLED: 'DELETE_PLAYERS_TABLE_VIEW_FULFILLED',
  DELETE_PLAYERS_TABLE_VIEW_FAILED: 'DELETE_PLAYERS_TABLE_VIEW_FAILED',

  SAVE_PLAYERS_TABLE_VIEW: 'SAVE_PLAYERS_TABLE_VIEW',

  POST_PLAYERS_TABLE_VIEW_PENDING: 'POST_PLAYERS_TABLE_VIEW_PENDING',
  POST_PLAYERS_TABLE_VIEW_FULFILLED: 'POST_PLAYERS_TABLE_VIEW_FULFILLED',
  POST_PLAYERS_TABLE_VIEW_FAILED: 'POST_PLAYERS_TABLE_VIEW_FAILED',

  players_table_view_changed: (players_table_view, view_change_params) => ({
    type: players_table_views_actions.PLAYERS_TABLE_VIEW_CHANGED,
    payload: { players_table_view, view_change_params }
  }),

  set_selected_players_table_view: (players_table_view_id) => ({
    type: players_table_views_actions.SET_SELECTED_PLAYERS_TABLE_VIEW,
    payload: {
      players_table_view_id,
      view_change_params: { view_state_changed: true }
    }
  }),

  get_players_table_views_pending: (opts) => ({
    type: players_table_views_actions.GET_PLAYERS_TABLE_VIEWS_PENDING,
    payload: { opts }
  }),

  get_players_table_views_fulfilled: (opts, data) => ({
    type: players_table_views_actions.GET_PLAYERS_TABLE_VIEWS_FULFILLED,
    payload: { opts, data }
  }),

  get_players_table_views_failed: (opts, error) => ({
    type: players_table_views_actions.GET_PLAYERS_TABLE_VIEWS_FAILED,
    payload: { opts, error }
  }),

  delete_players_table_view: (players_table_view_id) => ({
    type: players_table_views_actions.DELETE_PLAYERS_TABLE_VIEW,
    payload: { players_table_view_id }
  }),

  delete_players_table_view_pending: (opts) => ({
    type: players_table_views_actions.DELETE_PLAYERS_TABLE_VIEW_PENDING,
    payload: { opts }
  }),

  delete_players_table_view_fulfilled: (opts, data) => ({
    type: players_table_views_actions.DELETE_PLAYERS_TABLE_VIEW_FULFILLED,
    payload: { opts, data }
  }),

  delete_players_table_view_failed: (opts, error) => ({
    type: players_table_views_actions.DELETE_PLAYERS_TABLE_VIEW_FAILED,
    payload: { opts, error }
  }),

  save_players_table_view: (players_table_view) => ({
    type: players_table_views_actions.SAVE_PLAYERS_TABLE_VIEW,
    payload: { players_table_view }
  }),

  post_players_table_view_pending: (opts) => ({
    type: players_table_views_actions.POST_PLAYERS_TABLE_VIEW_PENDING,
    payload: { opts }
  }),

  post_players_table_view_fulfilled: (opts, data) => ({
    type: players_table_views_actions.POST_PLAYERS_TABLE_VIEW_FULFILLED,
    payload: { opts, data }
  }),

  post_players_table_view_failed: (opts, error) => ({
    type: players_table_views_actions.POST_PLAYERS_TABLE_VIEW_FAILED,
    payload: { opts, error }
  })
}

export const get_players_table_views_actions = {
  failed: players_table_views_actions.get_players_table_views_failed,
  pending: players_table_views_actions.get_players_table_views_pending,
  fulfilled: players_table_views_actions.get_players_table_views_fulfilled
}

export const delete_players_table_view_actions = {
  failed: players_table_views_actions.delete_players_table_view_failed,
  pending: players_table_views_actions.delete_players_table_view_pending,
  fulfilled: players_table_views_actions.delete_players_table_view_fulfilled
}

export const post_players_table_view_actions = {
  failed: players_table_views_actions.post_players_table_view_failed,
  pending: players_table_views_actions.post_players_table_view_pending,
  fulfilled: players_table_views_actions.post_players_table_view_fulfilled
}
