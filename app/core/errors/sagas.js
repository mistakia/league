import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { errorActions } from './actions'
import { postError } from '@core/api'

export function * report ({ payload }) {
  const { leagueId, teamId, userId } = yield select(getApp)
  const { message, stack } = payload
  yield call(postError, {
    ignoreError: true,
    leagueId,
    teamId,
    userId,
    error: {
      message,
      stack,
      url: document.location.href
    }
  })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchReport () {
  yield takeLatest(errorActions.REPORT_ERROR, report)
}

//= ====================================
//  ROOT
// -------------------------------------

export const errorSagas = [
  fork(watchReport)
]
