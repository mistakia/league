import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const draft_pick_value_actions = {
  ...create_api_action_types('GET_DRAFT_PICK_VALUE'),

  LOAD_DRAFT_PICK_VALUE: 'LOAD_DRAFT_PICK_VALUE',
  load_draft_pick_value: () => ({
    type: draft_pick_value_actions.LOAD_DRAFT_PICK_VALUE
  })
}

export const get_draft_pick_value_actions = create_api_actions(
  'GET_DRAFT_PICK_VALUE'
)
