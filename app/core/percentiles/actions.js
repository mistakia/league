import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const percentile_actions = {
  ...create_api_action_types('GET_PERCENTILES'),

  LOAD_PERCENTILES: 'LOAD_PERCENTILES',
  load_percentiles: (percentile_key) => ({
    type: percentile_actions.LOAD_PERCENTILES,
    payload: {
      percentile_key
    }
  })
}

export const get_percentiles_actions = create_api_actions('GET_PERCENTILES')
