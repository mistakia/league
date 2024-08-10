import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const poachActions = {
  ...create_api_action_types('POST_POACH'),
  ...create_api_action_types('PUT_POACH'),
  ...create_api_action_types('POST_PROCESS_POACH'),

  UPDATE_POACH: 'UPDATE_POACH',
  update: ({ poachId, release }) => ({
    type: poachActions.UPDATE_POACH,
    payload: {
      poachId,
      release
    }
  }),

  POACH_PLAYER: 'POACH_PLAYER',
  poach: ({ pid, release }) => ({
    type: poachActions.POACH_PLAYER,
    payload: {
      pid,
      release
    }
  }),

  PROCESS_POACH: 'PROCESS_POACH',
  process_poach: (poachId) => ({
    type: poachActions.PROCESS_POACH,
    payload: {
      poachId
    }
  })
}

export const postPoachActions = create_api_actions('POST_POACH')
export const putPoachActions = create_api_actions('PUT_POACH')
export const postProcessPoachActions = create_api_actions('POST_PROCESS_POACH')
