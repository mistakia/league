import { all } from 'redux-saga/effects'

import { appSagas } from './app'
import { auctionSagas } from './auction'
import { draftSagas } from './draft'
import { playerSagas } from './players'
import { rosterSagas } from './rosters'
import { teamSagas } from './teams'
import { wsSagas } from './ws'

export default function * rootSaga () {
  yield all([
    ...appSagas,
    ...auctionSagas,
    ...draftSagas,
    ...playerSagas,
    ...rosterSagas,
    ...teamSagas,
    ...wsSagas
  ])
}
