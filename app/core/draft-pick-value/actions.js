import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const draftPickValueActions = {
  ...create_api_action_types('GET_DRAFT_PICK_VALUE'),

  LOAD_DRAFT_PICK_VALUE: 'LOAD_DRAFT_PICK_VALUE',
  loadDraftPickValue: () => ({
    type: draftPickValueActions.LOAD_DRAFT_PICK_VALUE
  })
}

export const getDraftPickValueActions = create_api_actions(
  'GET_DRAFT_PICK_VALUE'
)
