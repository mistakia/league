import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const draftActions = {
  DRAFTED_PLAYER: 'DRAFTED_PLAYER',

  ...create_api_action_types('GET_DRAFT'),
  ...create_api_action_types('POST_DRAFT'),

  DRAFT_SELECT_PLAYER: 'DRAFT_SELECT_PLAYER',
  selectPlayer: (pid) => ({
    type: draftActions.DRAFT_SELECT_PLAYER,
    payload: {
      pid
    }
  }),

  LOAD_DRAFT: 'LOAD_DRAFT',
  loadDraft: () => ({
    type: draftActions.LOAD_DRAFT
  }),

  DRAFT_PLAYER: 'DRAFT_PLAYER',
  draftPlayer: () => ({
    type: draftActions.DRAFT_PLAYER
  })
}

export const getDraftActions = create_api_actions('GET_DRAFT')
export const postDraftActions = create_api_actions('POST_DRAFT')
