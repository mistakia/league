import { call, takeLatest, fork, put, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { settingActions } from './actions'
import { putSetting, putBaselines } from '@core/api'
import { calculateValues } from '@core/players'

export function * updateSetting ({ payload }) {
  const { token } = yield select(getApp)
  if (token) yield call(putSetting, payload)
  else yield put(settingActions.set(payload))

  if (['vbaseline', 'vorpw', 'volsw'].includes(payload.type)) {
    yield call(calculateValues)
  }
}

export function * updateBaselines ({ payload }) {
  const { token } = yield select(getApp)
  const { baselines } = payload
  if (token) yield call(putBaselines, baselines)
  else yield put(settingActions.setBaselines(baselines))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchUpdateSetting () {
  yield takeLatest(settingActions.UPDATE_SETTING, updateSetting)
}

export function * watchUpdateBaselines () {
  yield takeLatest(settingActions.UPDATE_BASELINES, updateBaselines)
}

//= ====================================
//  ROOT
// -------------------------------------

export const settingSagas = [
  fork(watchUpdateSetting),
  fork(watchUpdateBaselines)
]
