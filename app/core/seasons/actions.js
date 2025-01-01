import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const seasons_actions = {
  ...create_api_action_types('GET_SEASON'),

  LOAD_SEASON: 'LOAD_SEASON',
  load_season: () => ({
    type: seasons_actions.LOAD_SEASON
  })
}

export const get_season_actions = create_api_actions('GET_SEASON')
