import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const errorActions = {
  ...create_api_action_types('POST_ERROR'),

  REPORT_ERROR: 'REPORT_ERROR',
  report: ({ message, stack }) => ({
    type: errorActions.REPORT_ERROR,
    payload: {
      message,
      stack
    }
  })
}

export const postErrorActions = create_api_actions('POST_ERROR')
