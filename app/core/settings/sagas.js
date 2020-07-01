import { call, takeLatest, fork } from 'redux-saga/effects'

import { settingActions } from './actions'
import { putSetting } from '@core/api'
import { calculateValues } from '@core/players'

export function * updateSetting ({ payload }) {
  yield call(putSetting, payload)

  if (['value', 'vorpw', 'volsw'].includes(payload.type)) {
    yield call(calculateValues)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchUpdateSetting () {
  yield takeLatest(settingActions.UPDATE_SETTING, updateSetting)
}

//= ====================================
//  ROOT
// -------------------------------------

export const settingSagas = [
  fork(watchUpdateSetting)
]
