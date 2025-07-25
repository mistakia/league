import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const error_actions = {
  ...create_api_action_types('POST_ERROR'),

  REPORT_ERROR: 'REPORT_ERROR',
  report: ({ message, stack }) => ({
    type: error_actions.REPORT_ERROR,
    payload: {
      message,
      stack
    }
  })
}

export const post_error_actions = create_api_actions('POST_ERROR')
