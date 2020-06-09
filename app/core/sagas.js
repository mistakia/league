import { all } from 'redux-saga/effects'

import { appSagas } from './app'
import { playerSagas } from './players'
import { rosterSagas } from './rosters'

export default function * rootSaga () {
  yield all([
    ...appSagas,
    ...playerSagas,
    ...rosterSagas
  ])
}
