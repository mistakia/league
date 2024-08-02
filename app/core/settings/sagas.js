import {
  call,
  takeLatest,
  fork,
  select,
  putResolve,
  put
} from 'redux-saga/effects'

import { get_app } from '@core/selectors'
import { settingActions } from './actions'
import { putSetting } from '@core/api'
import { notificationActions } from '@core/notifications/actions'

export function* updateSetting({ payload }) {
  const { token } = yield select(get_app)
  if (token) yield call(putSetting, payload)
  else yield putResolve(settingActions.set(payload))
}

export function* putSettingFulfilled({ payload }) {
  const { opts } = payload
  const { type } = opts
  yield put(
    notificationActions.show({
      message: `${type} saved`,
      severity: 'success'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchUpdateSetting() {
  yield takeLatest(settingActions.UPDATE_SETTING, updateSetting)
}

export function* watchPutSettingFulfilled() {
  yield takeLatest(settingActions.PUT_SETTING_FULFILLED, putSettingFulfilled)
}

//= ====================================
//  ROOT
// -------------------------------------

export const settingSagas = [
  fork(watchUpdateSetting),
  fork(watchPutSettingFulfilled)
]
