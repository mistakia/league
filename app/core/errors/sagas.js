import { takeLatest, fork, put } from 'redux-saga/effects'

import { error_actions } from './actions'
import { auction_actions } from '@core/auction'
import { notification_actions } from '@core/notifications'

export function* report({ payload }) {
  // const { leagueId, teamId, userId } = yield select(get_app)
  // const { message, stack } = payload
  /* yield call(postError, {
   *   ignore_error: true,
   *   leagueId,
   *   teamId,
   *   userId,
   *   error: {
   *     message,
   *     stack,
   *     url: document.location.href
   *   }
   * }) */
}

export function* report_auction({ payload }) {
  yield put(
    notification_actions.show({
      message: payload.error,
      severity: 'error'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_report() {
  yield takeLatest(error_actions.REPORT_ERROR, report)
}

export function* watch_auction_error() {
  yield takeLatest(auction_actions.AUCTION_ERROR, report_auction)
}

//= ====================================
//  ROOT
// -------------------------------------

export const error_sagas = [fork(watch_auction_error), fork(watch_report)]
