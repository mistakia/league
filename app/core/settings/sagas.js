import { call, takeLatest, fork, select, putResolve } from 'redux-saga/effects'

import { get_app } from '@core/selectors'
import { settingActions } from './actions'
import { putSetting } from '@core/api'

export function* updateSetting({ payload }) {
  const { token } = yield select(get_app)
  if (token) yield call(putSetting, payload)
  else yield putResolve(settingActions.set(payload))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchUpdateSetting() {
  yield takeLatest(settingActions.UPDATE_SETTING, updateSetting)
}

//= ====================================
//  ROOT
// -------------------------------------

export const settingSagas = [fork(watchUpdateSetting)]
