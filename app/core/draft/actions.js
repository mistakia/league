import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types, create_toggle_action } =
  actions_utils

export const draft_actions = {
  DRAFTED_PLAYER: 'DRAFTED_PLAYER',

  ...create_api_action_types('GET_DRAFT'),
  ...create_api_action_types('POST_DRAFT'),
  ...create_api_action_types('GET_DRAFT_PICK_DETAILS'),

  DRAFT_SELECT_PLAYER: 'DRAFT_SELECT_PLAYER',
  select_player: (pid) => ({
    type: draft_actions.DRAFT_SELECT_PLAYER,
    payload: { pid }
  }),

  LOAD_DRAFT: 'LOAD_DRAFT',
  load_draft: create_toggle_action('LOAD_DRAFT'),

  DRAFT_PLAYER: 'DRAFT_PLAYER',
  draft_player: create_toggle_action('DRAFT_PLAYER'),

  SET_EXPANDED_PICK_ID: 'SET_EXPANDED_PICK_ID',
  set_expanded_pick_id: (pick_id) => ({
    type: draft_actions.SET_EXPANDED_PICK_ID,
    payload: { pick_id }
  }),

  LOAD_DRAFT_PICK_DETAILS: 'LOAD_DRAFT_PICK_DETAILS',
  load_draft_pick_details: (pick_id) => ({
    type: draft_actions.LOAD_DRAFT_PICK_DETAILS,
    payload: { pick_id }
  })
}

export const get_draft_actions = create_api_actions('GET_DRAFT')
export const post_draft_actions = create_api_actions('POST_DRAFT')
export const get_draft_pick_details_actions = create_api_actions(
  'GET_DRAFT_PICK_DETAILS'
)
