export const settingActions = {
  UPDATE_SETTING: 'UPDATE_SETTING',

  SET_SETTING: 'SET_SETTING',

  PUT_SETTING_FAILED: 'PUT_SETTING_FAILED',
  PUT_SETTING_PENDING: 'PUT_SETTING_PENDING',
  PUT_SETTING_FULFILLED: 'PUT_SETTING_FULFILLED',

  update: ({ type, value }) => ({
    type: settingActions.UPDATE_SETTING,
    payload: {
      type,
      value
    }
  }),

  set: (opts) => ({
    type: settingActions.SET_SETTING,
    payload: {
      opts
    }
  }),

  putSettingFailed: (opts, error) => ({
    type: settingActions.PUT_SETTING_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putSettingPending: (opts) => ({
    type: settingActions.PUT_SETTING_PENDING,
    payload: {
      opts
    }
  }),

  putSettingFulfilled: (opts, data) => ({
    type: settingActions.PUT_SETTING_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const putSettingActions = {
  failed: settingActions.putSettingFailed,
  pending: settingActions.putSettingPending,
  fulfilled: settingActions.putSettingFulfilled
}
