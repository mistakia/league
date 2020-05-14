import { all } from 'redux-saga/effects'

import { appSagas } from './app'
import { playerSagas } from './players'

export default function * rootSaga () {
  yield all([
    ...appSagas,
    ...playerSagas
  ])
}
