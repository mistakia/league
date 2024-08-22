import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const data_views_actions = {
  ...create_api_action_types('GET_DATA_VIEWS'),
  ...create_api_action_types('DELETE_DATA_VIEW'),
  ...create_api_action_types('POST_DATA_VIEW'),
  ...create_api_action_types('POST_DATA_VIEW_SEARCH'),

  DATA_VIEW_CHANGED: 'DATA_VIEW_CHANGED',
  data_view_changed: (data_view, view_change_params) => ({
    type: data_views_actions.DATA_VIEW_CHANGED,
    payload: { data_view, view_change_params }
  }),

  SET_SELECTED_DATA_VIEW: 'SET_SELECTED_DATA_VIEW',
  set_selected_data_view: (data_view_id) => ({
    type: data_views_actions.SET_SELECTED_DATA_VIEW,
    payload: {
      data_view_id,
      view_change_params: { view_state_changed: true }
    }
  }),

  DELETE_DATA_VIEW: 'DELETE_DATA_VIEW',
  delete_data_view: (data_view_id) => ({
    type: data_views_actions.DELETE_DATA_VIEW,
    payload: { data_view_id }
  }),

  SAVE_DATA_VIEW: 'SAVE_DATA_VIEW',
  save_data_view: (data_view) => ({
    type: data_views_actions.SAVE_DATA_VIEW,
    payload: { data_view }
  }),

  LOAD_DATA_VIEWS: 'LOAD_DATA_VIEWS',
  load_data_views: ({ user_id, username } = {}) => ({
    type: data_views_actions.LOAD_DATA_VIEWS,
    payload: { user_id, username }
  })
}

export const get_data_views_actions = create_api_actions('GET_DATA_VIEWS')
export const delete_data_view_actions = create_api_actions('DELETE_DATA_VIEW')
export const post_data_view_actions = create_api_actions('POST_DATA_VIEW')
export const post_data_view_search_actions = create_api_actions(
  'POST_DATA_VIEW_SEARCH'
)