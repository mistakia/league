import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const playActions = {
  ...create_api_action_types('GET_PLAYS'),
  ...create_api_action_types('GET_PLAYSTATS')
}

export const getPlaysActions = create_api_actions('GET_PLAYS')
export const getPlayStatsActions = create_api_actions('GET_PLAYSTATS')
