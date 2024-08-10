import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const sourceActions = {
  ...create_api_action_types('GET_SOURCES'),
  ...create_api_action_types('PUT_SOURCE'),

  UPDATE_SOURCE: 'UPDATE_SOURCE',
  update: ({ sourceId, weight }) => ({
    type: sourceActions.UPDATE_SOURCE,
    payload: {
      sourceId,
      weight
    }
  }),
  SET_SOURCE: 'SET_SOURCE',
  set: (opts) => ({
    type: sourceActions.SET_SOURCE,
    payload: {
      opts
    }
  })
}

export const putSourceActions = create_api_actions('PUT_SOURCE')
export const getSourcesActions = create_api_actions('GET_SOURCES')
