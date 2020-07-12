import { call, takeLatest, fork, put, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { settingActions } from './actions'
import { putSetting } from '@core/api'
import { calculateValues } from '@core/players'

export function * updateSetting ({ payload }) {
  const { token } = yield select(getApp)
  if (token) yield call(putSetting, payload)
  else yield put(settingActions.set(payload))

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
