import { call, take, fork } from 'redux-saga/effects'

import { appActions } from './actions'
// import history from '@core/history'

export function * watchInitApp () {
  while (true) {
    const { payload } = yield take(appActions.INIT_APP)
    console.log(payload)
  }
}

/* export function * goBack () {
 *   yield call(history.goBack)
 * }
 *  */
export const appSagas = [
  fork(watchInitApp)
]
