import { takeLatest, fork, put } from 'redux-saga/effects'

import { errorActions } from './actions'
import { auctionActions } from '@core/auction'
import { notificationActions } from '@core/notifications'

export function* report({ payload }) {
  // const { leagueId, teamId, userId } = yield select(get_app)
  // const { message, stack } = payload
  /* yield call(postError, {
   *   ignoreError: true,
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

export function* reportAuction({ payload }) {
  yield put(
    notificationActions.show({
      message: payload.error,
      severity: 'error'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchReport() {
  yield takeLatest(errorActions.REPORT_ERROR, report)
}

export function* watchAuctionError() {
  yield takeLatest(auctionActions.AUCTION_ERROR, reportAuction)
}

//= ====================================
//  ROOT
// -------------------------------------

export const errorSagas = [fork(watchAuctionError), fork(watchReport)]
