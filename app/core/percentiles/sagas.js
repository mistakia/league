import { fork, takeEvery, call, select } from 'redux-saga/effects'

import { percentile_actions } from './actions'
import { api_get_percentiles } from '@core/api'
import { get_request_history } from '@core/selectors'

export function* load_percentiles({ payload }) {
  const request_history = yield select(get_request_history)
  const key = `GET_PERCENTILES_${payload.percentile_key}`
  if (!request_history.has(key)) {
    yield call(api_get_percentiles, payload)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_load_percentiles() {
  yield takeEvery(percentile_actions.LOAD_PERCENTILES, load_percentiles)
}

//= ====================================
//  ROOT
// -------------------------------------

export const percentile_sagas = [fork(watch_load_percentiles)]
