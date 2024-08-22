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
import { waiverSagas } from './waivers'
import { poachSagas } from './poaches'
import { scheduleSagas } from './schedule'
import { errorSagas } from './errors'
import { statusSagas } from './status'
import { scoreboardSagas } from './scoreboard'
import { playSagas } from './plays'
import { gamelogSagas } from './gamelogs'
import { propSagas } from './props'
import { draftPickValueSagas } from './draft-pick-value'
import { seasonlogSagas } from './seasonlogs'
import { percentileSagas } from './percentiles'
import { league_team_daily_values_sagas } from './league-team-daily-values'
import { data_views_sagas } from './data-views'
import { league_careerlogs_sagas } from './league-careerlogs'

export default function* rootSaga() {
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
    ...statSagas,
    ...waiverSagas,
    ...poachSagas,
    ...scheduleSagas,
    ...errorSagas,
    ...statusSagas,
    ...scoreboardSagas,
    ...playSagas,
    ...gamelogSagas,
    ...propSagas,
    ...draftPickValueSagas,
    ...seasonlogSagas,
    ...percentileSagas,
    ...league_team_daily_values_sagas,
    ...data_views_sagas,
    ...league_careerlogs_sagas
  ])
}
