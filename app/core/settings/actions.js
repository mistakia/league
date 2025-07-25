import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const setting_actions = {
  ...create_api_action_types('PUT_SETTING'),

  UPDATE_SETTING: 'UPDATE_SETTING',
  update: ({ type, value }) => ({
    type: setting_actions.UPDATE_SETTING,
    payload: {
      type,
      value
    }
  }),

  SET_SETTING: 'SET_SETTING',
  set: (opts) => ({
    type: setting_actions.SET_SETTING,
    payload: {
      opts
    }
  })
}

export const put_setting_actions = create_api_actions('PUT_SETTING')
