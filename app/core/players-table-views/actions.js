import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const players_table_views_actions = {
  ...create_api_action_types('GET_PLAYERS_TABLE_VIEWS'),
  ...create_api_action_types('DELETE_PLAYERS_TABLE_VIEW'),
  ...create_api_action_types('POST_PLAYERS_TABLE_VIEW'),

  PLAYERS_TABLE_VIEW_CHANGED: 'PLAYERS_TABLE_VIEW_CHANGED',
  players_table_view_changed: (players_table_view, view_change_params) => ({
    type: players_table_views_actions.PLAYERS_TABLE_VIEW_CHANGED,
    payload: { players_table_view, view_change_params }
  }),

  SET_SELECTED_PLAYERS_TABLE_VIEW: 'SET_SELECTED_PLAYERS_TABLE_VIEW',
  set_selected_players_table_view: (players_table_view_id) => ({
    type: players_table_views_actions.SET_SELECTED_PLAYERS_TABLE_VIEW,
    payload: {
      players_table_view_id,
      view_change_params: { view_state_changed: true }
    }
  }),

  DELETE_PLAYERS_TABLE_VIEW: 'DELETE_PLAYERS_TABLE_VIEW',
  delete_players_table_view: (players_table_view_id) => ({
    type: players_table_views_actions.DELETE_PLAYERS_TABLE_VIEW,
    payload: { players_table_view_id }
  }),

  SAVE_PLAYERS_TABLE_VIEW: 'SAVE_PLAYERS_TABLE_VIEW',
  save_players_table_view: (players_table_view) => ({
    type: players_table_views_actions.SAVE_PLAYERS_TABLE_VIEW,
    payload: { players_table_view }
  })
}

export const get_players_table_views_actions = create_api_actions(
  'GET_PLAYERS_TABLE_VIEWS'
)
export const delete_players_table_view_actions = create_api_actions(
  'DELETE_PLAYERS_TABLE_VIEW'
)
export const post_players_table_view_actions = create_api_actions(
  'POST_PLAYERS_TABLE_VIEW'
)
