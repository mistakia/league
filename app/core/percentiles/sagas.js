import { fork, takeLatest, call } from 'redux-saga/effects'

import { percentileActions } from './actions'
import { getPercentiles } from '@core/api'

export function* loadPercentiles({ payload }) {
  yield call(getPercentiles, payload)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadPercentiles() {
  yield takeLatest(percentileActions.LOAD_PERCENTILES, loadPercentiles)
}

//= ====================================
//  ROOT
// -------------------------------------

export const percentileSagas = [fork(watchLoadPercentiles)]
