import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const statusActions = {
  ...create_api_action_types('GET_STATUS'),

  LOAD_STATUS: 'LOAD_STATUS',
  load: () => ({
    type: statusActions.LOAD_STATUS
  })
}

export const getStatusActions = create_api_actions('GET_STATUS')
