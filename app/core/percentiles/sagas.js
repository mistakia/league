import { fork, takeEvery, call, select } from 'redux-saga/effects'

import { percentileActions } from './actions'
import { getPercentiles } from '@core/api'
import { get_request_history } from '@core/selectors'

export function* loadPercentiles({ payload }) {
  const request_history = yield select(get_request_history)
  const key = `GET_PERCENTILES_${payload.percentile_key}`
  if (!request_history.has(key)) {
    yield call(getPercentiles, payload)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadPercentiles() {
  yield takeEvery(percentileActions.LOAD_PERCENTILES, loadPercentiles)
}

//= ====================================
//  ROOT
// -------------------------------------

export const percentileSagas = [fork(watchLoadPercentiles)]
