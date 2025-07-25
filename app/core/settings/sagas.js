import {
  call,
  takeLatest,
  fork,
  select,
  putResolve,
  put
} from 'redux-saga/effects'

import { get_app } from '@core/selectors'
import { setting_actions } from './actions'
import { api_put_setting } from '@core/api'
import { notification_actions } from '@core/notifications/actions'

export function* updateSetting({ payload }) {
  const { token } = yield select(get_app)
  if (token) yield call(api_put_setting, payload)
  else yield putResolve(setting_actions.set(payload))
}

export function* putSettingFulfilled({ payload }) {
  const { opts } = payload
  const { type } = opts
  yield put(
    notification_actions.show({
      message: `${type} saved`,
      severity: 'success'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchUpdateSetting() {
  yield takeLatest(setting_actions.UPDATE_SETTING, updateSetting)
}

export function* watchPutSettingFulfilled() {
  yield takeLatest(setting_actions.PUT_SETTING_FULFILLED, putSettingFulfilled)
}

//= ====================================
//  ROOT
// -------------------------------------

export const setting_sagas = [
  fork(watchUpdateSetting),
  fork(watchPutSettingFulfilled)
]
