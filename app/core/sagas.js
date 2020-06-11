import { all } from 'redux-saga/effects'

import { appSagas } from './app'
import { draftSagas } from './draft'
import { playerSagas } from './players'
import { rosterSagas } from './rosters'
import { teamSagas } from './teams'

export default function * rootSaga () {
  yield all([
    ...appSagas,
    ...draftSagas,
    ...playerSagas,
    ...rosterSagas,
    ...teamSagas
  ])
}
