import { all } from 'redux-saga/effects'

import { appSagas } from './app'
import { auctionSagas } from './auction'
import { draftSagas } from './draft'
import { playerSagas } from './players'
import { rosterSagas } from './rosters'
import { teamSagas } from './teams'
import { wsSagas } from './ws'
import { transactionSagas } from './transactions'
import { matchupSagas } from './matchups'
import { tradeSagas } from './trade'
import { leagueSagas } from './leagues'
import { sourceSagas } from './sources'
import { settingSagas } from './settings'
import { statSagas } from './stats'

export default function * rootSaga () {
  yield all([
    ...appSagas,
    ...auctionSagas,
    ...draftSagas,
    ...playerSagas,
    ...rosterSagas,
    ...teamSagas,
    ...wsSagas,
    ...transactionSagas,
    ...matchupSagas,
    ...tradeSagas,
    ...leagueSagas,
    ...sourceSagas,
    ...settingSagas,
    ...statSagas
  ])
}
