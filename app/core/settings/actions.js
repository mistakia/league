import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const settingActions = {
  ...create_api_action_types('PUT_SETTING'),

  UPDATE_SETTING: 'UPDATE_SETTING',
  update: ({ type, value }) => ({
    type: settingActions.UPDATE_SETTING,
    payload: {
      type,
      value
    }
  }),

  SET_SETTING: 'SET_SETTING',
  set: (opts) => ({
    type: settingActions.SET_SETTING,
    payload: {
      opts
    }
  })
}

export const putSettingActions = create_api_actions('PUT_SETTING')
