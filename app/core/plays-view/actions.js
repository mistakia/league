import { actions_utils } from '@core/utils'
const {
  create_api_actions,
  create_api_action_types,
  create_toggle_action,
  create_load_action
} = actions_utils

export const plays_views_actions = {
  ...create_api_action_types('GET_PLAYS_VIEWS'),
  ...create_api_action_types('DELETE_PLAYS_VIEW'),
  ...create_api_action_types('POST_PLAYS_VIEW'),
  ...create_api_action_types('GET_PLAYS_VIEW'),

  PLAYS_VIEW_CHANGED: 'PLAYS_VIEW_CHANGED',
  plays_view_changed: (data_view, view_change_params) => ({
    type: plays_views_actions.PLAYS_VIEW_CHANGED,
    payload: { data_view, view_change_params }
  }),

  SET_SELECTED_PLAYS_VIEW: 'SET_SELECTED_PLAYS_VIEW',
  set_selected_plays_view: (data_view_id) => ({
    type: plays_views_actions.SET_SELECTED_PLAYS_VIEW,
    payload: {
      data_view_id,
      view_change_params: { view_state_changed: true }
    }
  }),

  RESET_PLAYS_VIEW_CACHE: 'RESET_PLAYS_VIEW_CACHE',
  reset_plays_view_cache: create_toggle_action('RESET_PLAYS_VIEW_CACHE'),

  DELETE_PLAYS_VIEW: 'DELETE_PLAYS_VIEW',
  delete_plays_view: (data_view_id) => ({
    type: plays_views_actions.DELETE_PLAYS_VIEW,
    payload: { data_view_id }
  }),

  SAVE_PLAYS_VIEW: 'SAVE_PLAYS_VIEW',
  save_plays_view: (data_view) => ({
    type: plays_views_actions.SAVE_PLAYS_VIEW,
    payload: { data_view }
  }),

  LOAD_PLAYS_VIEWS: 'LOAD_PLAYS_VIEWS',
  load_plays_views: create_load_action('LOAD_PLAYS_VIEWS'),

  LOAD_PLAYS_VIEW: 'LOAD_PLAYS_VIEW',
  load_plays_view: (data_view_id) => ({
    type: plays_views_actions.LOAD_PLAYS_VIEW,
    payload: { data_view_id }
  }),

  SELECTED_PLAYER_PLAYS_REQUEST: 'SELECTED_PLAYER_PLAYS_REQUEST',
  selected_player_plays_request: (params) => ({
    type: plays_views_actions.SELECTED_PLAYER_PLAYS_REQUEST,
    payload: params
  })
}

export const get_plays_views_actions = create_api_actions('GET_PLAYS_VIEWS')
export const delete_plays_view_actions = create_api_actions('DELETE_PLAYS_VIEW')
export const post_plays_view_actions = create_api_actions('POST_PLAYS_VIEW')
export const get_plays_view_actions = create_api_actions('GET_PLAYS_VIEW')
