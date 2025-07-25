import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const schedule_actions = {
  ...create_api_action_types('GET_SCHEDULE')
}

export const get_schedule_actions = create_api_actions('GET_SCHEDULE')
