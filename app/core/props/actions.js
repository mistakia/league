import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const propActions = {
  ...create_api_action_types('GET_PROPS'),

  LOAD_PROPS: 'LOAD_PROPS',
  load: () => ({
    type: propActions.LOAD_PROPS
  })
}

export const getPropsActions = create_api_actions('GET_PROPS')
