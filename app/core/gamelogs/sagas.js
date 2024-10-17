import { fork, select, call, takeEvery } from 'redux-saga/effects'

import { getPlayersGamelogs } from '@core/api'
import { get_app, get_request_history } from '@core/selectors'
import { matchupsActions } from '@core/matchups'
import { gamelogsActions } from './actions'
import { constants } from '@libs-shared'

export function* load({ payload }) {
  const { leagueId } = yield select(get_app)
  const { year, week, nfl_team, opponent, position } = payload

  const params = {
    leagueId,
    year,
    week,
    nfl_team,
    position
  }

  switch (position) {
    case 'QB':
      params.passing = true
      params.rushing = true
      break
    case 'RB':
      params.rushing = true
      params.receiving = true
      break
    case 'WR':
    case 'TE':
      params.receiving = true
      break
  }

  // load last week gamelogs as well when its the final week of the championship round
  if (week === constants.season.finalWeek && week === constants.season.week) {
    yield call(load, {
      payload: {
        leagueId,
        year,
        week: week - 1,
        nfl_team,
        opponent,
        position
      }
    })
  }

  const request_history = yield select(get_request_history)

  if (request_history.has(`GET_GAMELOGS_${leagueId}_${year}_X_X_X_X`)) {
    return
  }

  if (
    week &&
    request_history.has(`GET_GAMELOGS_${leagueId}_${year}_${week}_X_X_X`)
  ) {
    return
  }

  const key = `GET_GAMELOGS_${leagueId}_${year}_${week || 'X'}_${
    nfl_team || 'X'
  }_${opponent || 'X'}_${position || 'X'}`

  if (!request_history.has(key)) {
    yield call(getPlayersGamelogs, params)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadMatchups() {
  yield takeEvery(matchupsActions.LOAD_MATCHUPS, load)
}

export function* watchLoadPlayerGamelogs() {
  yield takeEvery(gamelogsActions.LOAD_PLAYERS_GAMELOGS, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const gamelogSagas = [
  fork(watchLoadMatchups),
  fork(watchLoadPlayerGamelogs)
]
