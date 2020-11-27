import { call, takeLatest, fork } from 'redux-saga/effects'

import { fetchProps } from '@core/api'
import { propActions } from './actions'

export function * load () {
  yield call(fetchProps)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadProps () {
  yield takeLatest(propActions.LOAD_PROPS, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const propSagas = [
  fork(watchLoadProps)
]
