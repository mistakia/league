import { all } from 'redux-saga/effects'

import { app_sagas } from './app'
import { auction_sagas } from './auction'
import { draft_sagas } from './draft'
import { player_sagas } from './players'
import { roster_sagas } from './rosters'
import { team_sagas } from './teams'
import { ws_sagas } from './ws'
import { transaction_sagas } from './transactions'
import { matchup_sagas } from './matchups'
import { trade_sagas } from './trade'
import { league_sagas } from './leagues'
import { source_sagas } from './sources'
import { setting_sagas } from './settings'
import { stat_sagas } from './stats'
import { waiver_sagas } from './waivers'
import { poach_sagas } from './poaches'
import { schedule_sagas } from './schedule'
import { error_sagas } from './errors'
import { status_sagas } from './status'
import { scoreboard_sagas } from './scoreboard'
import { play_sagas } from './plays'
import { gamelog_sagas } from './gamelogs'
import { draft_pick_value_sagas } from './draft-pick-value'
import { seasonlog_sagas } from './seasonlogs'
import { percentile_sagas } from './percentiles'
import { league_team_daily_values_sagas } from './league-team-daily-values'
import { data_views_sagas } from './data-views'
import { league_careerlogs_sagas } from './league-careerlogs'
import { seasons_sagas } from './seasons'

export default function* rootSaga() {
  yield all([
    ...app_sagas,
    ...auction_sagas,
    ...draft_sagas,
    ...player_sagas,
    ...roster_sagas,
    ...team_sagas,
    ...ws_sagas,
    ...transaction_sagas,
    ...matchup_sagas,
    ...trade_sagas,
    ...league_sagas,
    ...source_sagas,
    ...setting_sagas,
    ...stat_sagas,
    ...waiver_sagas,
    ...poach_sagas,
    ...schedule_sagas,
    ...error_sagas,
    ...status_sagas,
    ...scoreboard_sagas,
    ...play_sagas,
    ...gamelog_sagas,
    ...draft_pick_value_sagas,
    ...seasonlog_sagas,
    ...percentile_sagas,
    ...league_team_daily_values_sagas,
    ...data_views_sagas,
    ...league_careerlogs_sagas,
    ...seasons_sagas
  ])
}
