export const settingActions = {
  UPDATE_SETTING: 'UPDATE_SETTING',

  UPDATE_BASELINES: 'UPDATE_BASELINES',

  SET_SETTING: 'SET_SETTING',

  SET_BASELINES: 'SET_BASELINES',

  PUT_SETTING_FAILED: 'PUT_SETTING_FAILED',
  PUT_SETTING_PENDING: 'PUT_SETTING_PENDING',
  PUT_SETTING_FULFILLED: 'PUT_SETTING_FULFILLED',

  PUT_BASELINES_FAILED: 'PUT_BASELINES_FAILED',
  PUT_BASELINES_PENDING: 'PUT_BASELINES_PENDING',
  PUT_BASELINES_FULFILLED: 'PUT_BASELINES_FULFILLED',

  update: ({ type, value }) => ({
    type: settingActions.UPDATE_SETTING,
    payload: {
      type,
      value
    }
  }),

  updateBaselines: (baselines) => ({
    type: settingActions.UPDATE_BASELINES,
    payload: {
      baselines
    }
  }),

  setBaselines: (data) => ({
    type: settingActions.SET_BASELINES,
    payload: {
      data
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
  }),

  putBaselinesPending: (opts) => ({
    type: settingActions.PUT_BASELINES_PENDING,
    payload: {
      opts
    }
  }),

  putBaselinesFailed: (opts, error) => ({
    type: settingActions.PUT_BASELINES_FAILED,
    payload: {
      opts,
      error
    }
  }),

  putBaselinesFulfilled: (opts, data) => ({
    type: settingActions.PUT_BASELINES_FULFILLED,
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

export const putBaselinesActions = {
  failed: settingActions.putBaselinesFailed,
  pending: settingActions.putBaselinesPending,
  fulfilled: settingActions.putBaselinesFulfilled
}
