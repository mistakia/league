import { actions_utils } from '@core/utils'
const {
  create_api_actions,
  create_api_action_types,
  create_toggle_action,
  create_load_action
} = actions_utils

export const dataViewsActions = {
  ...create_api_action_types('GET_DATA_VIEWS'),
  ...create_api_action_types('DELETE_DATA_VIEW'),
  ...create_api_action_types('POST_DATA_VIEW'),
  ...create_api_action_types('GET_DATA_VIEW'),

  DATA_VIEW_CHANGED: 'DATA_VIEW_CHANGED',
  dataViewChanged: (data_view, view_change_params) => ({
    type: dataViewsActions.DATA_VIEW_CHANGED,
    payload: { data_view, view_change_params }
  }),

  SET_SELECTED_DATA_VIEW: 'SET_SELECTED_DATA_VIEW',
  setSelectedDataView: (data_view_id) => ({
    type: dataViewsActions.SET_SELECTED_DATA_VIEW,
    payload: {
      data_view_id,
      view_change_params: { view_state_changed: true }
    }
  }),

  RESET_DATA_VIEW_CACHE: 'RESET_DATA_VIEW_CACHE',
  resetDataViewCache: create_toggle_action('RESET_DATA_VIEW_CACHE'),

  DELETE_DATA_VIEW: 'DELETE_DATA_VIEW',
  deleteDataView: (data_view_id) => ({
    type: dataViewsActions.DELETE_DATA_VIEW,
    payload: { data_view_id }
  }),

  SAVE_DATA_VIEW: 'SAVE_DATA_VIEW',
  saveDataView: (data_view) => ({
    type: dataViewsActions.SAVE_DATA_VIEW,
    payload: { data_view }
  }),

  LOAD_DATA_VIEWS: 'LOAD_DATA_VIEWS',
  loadDataViews: create_load_action('LOAD_DATA_VIEWS'),

  LOAD_DATA_VIEW: 'LOAD_DATA_VIEW',
  loadDataView: create_load_action('LOAD_DATA_VIEW')
}

export const getDataViewsActions = create_api_actions('GET_DATA_VIEWS')
export const deleteDataViewActions = create_api_actions('DELETE_DATA_VIEW')
export const postDataViewActions = create_api_actions('POST_DATA_VIEW')
export const getDataViewActions = create_api_actions('GET_DATA_VIEW')
